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
  run: (input: unknown, context: FeatureContext) => Promise<unknown>;
};

const FEATURES: Record<string, Feature> = {
  /** 設定の確認だけ（Claude は呼ばない） */
  status: {
    usesClaude: false,
    run: async () => ({
      configured: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
      model: getModel(),
    }),
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
