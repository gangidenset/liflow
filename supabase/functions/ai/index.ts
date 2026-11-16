// AI LIFE MANAGER Lite の AI 機能を受け持つ Supabase Edge Function。
//
// - Claude API の鍵（ANTHROPIC_API_KEY）はこの関数の中だけで使い、アプリには渡さない
// - ログイン中のユーザーだけが呼べる（auth: 'user'）。AI_ALLOWED_EMAILS で利用者をさらに絞れる
// - AI へのお願い文（プロンプト）はこの関数の中で固定し、アプリから任意の文を送らせない
// - 1 日あたりの呼び出し回数に上限を設ける（AI_DAILY_LIMIT）
// - タスクや家計簿の内容はログに出さない
//
// 設定する秘密の値（Supabase の Edge Function Secrets）:
//   ANTHROPIC_API_KEY  必須。Anthropic の API キー
//   AI_ALLOWED_EMAILS  任意。使ってよいメールアドレス（カンマ区切り）。空なら全ログインユーザー
//   AI_DAILY_LIMIT     任意。1 ユーザー 1 日あたりの上限回数（既定 100）
//   AI_MODEL           任意。使うモデル（既定 claude-opus-5-5）

import Anthropic from 'npm:@anthropic-ai/sdk@1';
import { withSupabase } from 'npm:@supabase/server@1';

const DEFAULT_MODEL = 'claude-opus-5-5';
const DEFAULT_DAILY_LIMIT = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 拒否されたときに別のモデルでやり直す仕組み（サーバー側）に対応しているモデル */
const MODELS_WITH_SERVER_FALLBACK = new Set([
  'claude-fable-5-2',
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

type ErrorCode =
  | 'bad_request'
  | 'not_allowed'
  | 'not_configured'
  | 'daily_limit'
  | 'ai_busy'
  | 'ai_refused'
  | 'ai_failed';

class AiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function errorResponse(error: AiError): Response {
  return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
}

// ---------------------------------------------------------------------------
// Claude の呼び出し
// ---------------------------------------------------------------------------

type JsonSchema = Record<string, unknown>;

type ClaudeRequest = {
  system: string;
  user: string;
  /** 返してほしい JSON の形 */
  schema: JsonSchema;
  maxTokens?: number;
};

function getModel(): string {
  return Deno.env.get('AI_MODEL')?.trim() || DEFAULT_MODEL;
}

/** Claude に決まった形の JSON で答えてもらう */
async function askClaudeForJson(request: ClaudeRequest): Promise<unknown> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new AiError('not_configured', 503, 'ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  const model = getModel();
  const useFallback = MODELS_WITH_SERVER_FALLBACK.has(model);

  let response;
  try {
    response = await client.beta.messages.create({
      model,
      max_tokens: request.maxTokens ?? 8000,
      system: request.system,
      messages: [{ role: 'user', content: request.user }],
      // 短い整理・抽出の仕事なので、考える深さは控えめにして速さと費用を抑える
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: request.schema },
      },
      // 安全のための判定で断られた場合、Anthropic が勧める別のモデルで自動的にやり直す
      ...(useFallback
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError('ai_busy', 503, 'Claude API rate limit');
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('Claude API rejected the API key');
      throw new AiError('not_configured', 503, 'Claude API rejected the API key');
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API error', error.status);
      throw new AiError(error.status && error.status >= 500 ? 'ai_busy' : 'ai_failed', 502, 'Claude API error');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiError('ai_busy', 503, 'Could not reach Claude API');
    }
    throw error;
  }

  if (response.stop_reason === 'refusal') {
    throw new AiError('ai_refused', 422, 'Claude declined the request');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AiError('ai_failed', 502, 'Claude response was cut off');
  }
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('ai_failed', 502, 'Claude returned invalid JSON');
  }
}

// ---------------------------------------------------------------------------
// 機能ごとの処理。アプリは feature の名前と入力だけを送る
// ---------------------------------------------------------------------------

type FeatureContext = {
  /** 利用者の端末の今日の日付（YYYY-MM-DD） */
  today: string;
};

type Feature = {
  /** Claude を呼ぶ（回数に数える）か */
  usesClaude: boolean;
  /** 入力の検査（回数を数える前に行う）。不正なら AiError を投げる */
  validate?: (input: unknown) => void;
  run: (input: unknown, context: FeatureContext) => Promise<unknown>;
};

// ---------------------------------------------------------------------------
// 文章からタスク・家計簿の下書きを作る（quick_add）
//   AI は下書きを返すだけで、保存はアプリで利用者が確認してから行う。
//   カテゴリなどの値はアプリ側（src/types/ledger.ts, src/types/task.ts）と同じものにそろえる。
// ---------------------------------------------------------------------------

export const QUICK_ADD_MAX_TEXT = 1000;
export const QUICK_ADD_MAX_ITEMS = 10;
const TITLE_MAX = 100;
const NOTE_MAX = 200;
const MAX_AMOUNT = 10_000_000;

export const EXPENSE_CATEGORIES: Record<string, string> = {
  food: '食費',
  daily: '日用品',
  transport: '交通',
  housing: '住居',
  utilities: '光熱・通信',
  medical: '医療',
  entertainment: '娯楽',
  clothing: '衣服',
  social: '交際',
  other: 'その他',
};

export const INCOME_CATEGORIES: Record<string, string> = {
  salary: '給与',
  bonus: '賞与',
  side: '副収入',
  other_income: 'その他',
};

const PRIORITIES = ['high', 'medium', 'low'] as const;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export type TaskDraft = {
  kind: 'task';
  title: string;
  note: string;
  dueDate: string | null;
  priority: (typeof PRIORITIES)[number];
};

export type LedgerDraft = {
  kind: 'expense' | 'income';
  amount: number;
  date: string;
  category: string;
  note: string;
};

export type Draft = TaskDraft | LedgerDraft;

/** 「値または null」。構造化出力で対応が明記されている anyOf で表す */
function nullable(schema: JsonSchema): JsonSchema {
  return { anyOf: [schema, { type: 'null' }] };
}

const QUICK_ADD_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['task', 'expense', 'income'] },
          title: { type: 'string' },
          note: { type: 'string' },
          due_date: nullable({ type: 'string', format: 'date' }),
          priority: { type: 'string', enum: [...PRIORITIES] },
          amount: nullable({ type: 'integer' }),
          date: nullable({ type: 'string', format: 'date' }),
          category: nullable({ type: 'string' }),
        },
        required: ['kind', 'title', 'note', 'due_date', 'priority', 'amount', 'date', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

function weekdayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Claude の答えを検査して、アプリで使える下書きにする。形の合わない項目は捨てる。
 * 日付が無い支出・収入は今日、カテゴリが合わないものは「その他」にする。
 */
export function normalizeDrafts(raw: unknown, today: string): Draft[] {
  const items = (raw as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const drafts: Draft[] = [];
  for (const item of items.slice(0, QUICK_ADD_MAX_ITEMS)) {
    if (typeof item !== 'object' || item === null) continue;
    const v = item as Record<string, unknown>;
    const note = text(v.note, NOTE_MAX);
    if (v.kind === 'task') {
      const title = text(v.title, TITLE_MAX);
      if (!title) continue;
      drafts.push({
        kind: 'task',
        title,
        note,
        dueDate: isValidDateKey(v.due_date) ? v.due_date : null,
        priority: PRIORITIES.includes(v.priority as TaskDraft['priority'])
          ? (v.priority as TaskDraft['priority'])
          : 'medium',
      });
    } else if (v.kind === 'expense' || v.kind === 'income') {
      const amount = v.amount;
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > MAX_AMOUNT) continue;
      const categories = v.kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
      const category =
        typeof v.category === 'string' && Object.hasOwn(categories, v.category)
          ? v.category
          : v.kind === 'expense'
            ? 'other'
            : 'other_income';
      // 支出・収入はメモが空なら、AI が付けた見出しをメモに使う
      const label = text(v.title, NOTE_MAX);
      drafts.push({
        kind: v.kind,
        amount,
        date: isValidDateKey(v.date) ? v.date : today,
        category,
        note: note || label,
      });
    }
  }
  return drafts;
}

function quickAddSystemPrompt(today: string): string {
  const list = (categories: Record<string, string>) =>
    Object.entries(categories)
      .map(([key, label]) => `${key}（${label}）`)
      .join('、');
  return [
    'あなたは日本語の生活管理アプリのアシスタントです。利用者が書いた文章から、タスクと家計簿（支出・収入）の下書きを作ります。',
    `今日は ${today}（${weekdayOf(today)}曜日）です。「明日」「金曜」「来週月曜」「月末」などの相対的な日付は、今日を基準に YYYY-MM-DD に直してください。`,
    '',
    '項目の種類:',
    '- task: やること。title に短く具体的な名前（例:「歯医者を予約する」）。期限が書かれていれば due_date、なければ null。',
    `  priority は high / medium / low。期限が今日・明日、または「急ぎ」「必ず」などがあれば high、特に手がかりがなければ medium。`,
    '- expense: お金を払った記録。金額（円の整数）が書かれているものだけ。',
    '- income: お金を受け取った記録。金額（円の整数）が書かれているものだけ。',
    '  expense と income は date に日付（書かれていなければ今日）、title に何の支出・収入かを短く（例:「ランチ」）。',
    `  expense の category: ${list(EXPENSE_CATEGORIES)}`,
    `  income の category: ${list(INCOME_CATEGORIES)}`,
    '',
    '決まりごと:',
    '- 文章に書かれていないことを付け足さない。金額が分からないお金の話は、作業として必要なら task にする（例:「家賃を払う」）。',
    '- 1 つの文章に複数の項目があれば、それぞれ別の項目にする。最大 10 件。',
    '- 使わない欄は、文字列なら空文字、それ以外は null にする（task の amount・date・category は null、expense・income の due_date は null、priority は medium）。',
    '- note には、文章に書かれた補足（場所・相手・数量など）があれば短く入れる。なければ空文字。',
    '- 生活の記録として読み取れる項目がなければ items を空にする。',
  ].join('\n');
}

const FEATURES: Record<string, Feature> = {
  /** 設定の確認だけ（Claude は呼ばない） */
  status: {
    usesClaude: false,
    run: async () => ({
      configured: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
      model: getModel(),
    }),
  },

  /** 文章からタスク・家計簿の下書きを作る */
  quick_add: {
    usesClaude: true,
    validate: (input) => {
      const value = (input as { text?: unknown } | undefined)?.text;
      if (typeof value !== 'string' || value.trim() === '') {
        throw new AiError('bad_request', 400, 'text is required');
      }
      if (value.length > QUICK_ADD_MAX_TEXT) {
        throw new AiError('bad_request', 400, 'text is too long');
      }
    },
    run: async (input, { today }) => {
      const userText = (input as { text: string }).text.trim();
      const result = await askClaudeForJson({
        system: quickAddSystemPrompt(today),
        user: `次の文章から下書きを作ってください。\n\n<text>\n${userText}\n</text>`,
        schema: QUICK_ADD_SCHEMA,
      });
      return { items: normalizeDrafts(result, today) };
    },
  },

  /** Claude と実際に通信できるかの確認 */
  test: {
    usesClaude: true,
    run: async (_input, { today }) => {
      const result = await askClaudeForJson({
        system: 'あなたは接続確認に応答するアシスタントです。',
        user: `接続確認です。今日の日付 ${today} の曜日を日本語 1 文字（例: 月）で答えてください。`,
        schema: {
          type: 'object',
          properties: { weekday: { type: 'string' } },
          required: ['weekday'],
          additionalProperties: false,
        },
        maxTokens: 2000,
      });
      return { ok: true, model: getModel(), reply: result };
    },
  },
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------


function isAllowed(email: string | undefined): boolean {
  const list = (Deno.env.get('AI_ALLOWED_EMAILS') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return true;
  return Boolean(email) && list.includes(email!.toLowerCase());
}

function dailyLimit(): number {
  const value = Number(Deno.env.get('AI_DAILY_LIMIT'));
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_DAILY_LIMIT;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    try {
      if (req.method !== 'POST') throw new AiError('bad_request', 405, 'POST only');

      let body: { feature?: unknown; input?: unknown; today?: unknown };
      try {
        body = await req.json();
      } catch {
        throw new AiError('bad_request', 400, 'Invalid JSON body');
      }

      const featureName = typeof body.feature === 'string' ? body.feature : '';
      const feature = Object.hasOwn(FEATURES, featureName) ? FEATURES[featureName] : undefined;
      if (!feature) throw new AiError('bad_request', 400, 'Unknown feature');

      const today =
        typeof body.today === 'string' && DATE_PATTERN.test(body.today)
          ? body.today
          : new Date().toISOString().slice(0, 10);

      if (!isAllowed(ctx.userClaims?.email)) {
        throw new AiError('not_allowed', 403, 'This account cannot use AI features');
      }

      feature.validate?.(body.input);

      if (feature.usesClaude) {
        // 呼び出し回数を数え、上限を超えていたら止める（数え方は supabase/schema.sql の関数）
        const { data: count, error } = await ctx.supabase.rpc('ai_usage_increment');
        if (error) {
          console.error('Failed to count AI usage', error.code);
          throw new AiError('ai_failed', 500, 'Failed to count AI usage');
        }
        if (typeof count === 'number' && count > dailyLimit()) {
          throw new AiError('daily_limit', 429, 'Daily AI limit reached');
        }
      }

      const result = await feature.run(body.input, { today });
      return Response.json({ data: result });
    } catch (error) {
      if (error instanceof AiError) return errorResponse(error);
      console.error('Unexpected error', error instanceof Error ? error.name : typeof error);
      return errorResponse(new AiError('ai_failed', 500, 'Unexpected error'));
    }
  }),
};
