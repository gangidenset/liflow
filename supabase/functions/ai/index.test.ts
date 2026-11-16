// Edge Function「ai」のテスト。Anthropic と Supabase の代わりに手元の偽サーバーを立て、
// 本物と同じ形式の署名付きログイントークンで呼び出す。
//
// 実行:
//   npm run test:functions

import { exportJWK, generateKeyPair, SignJWT } from 'npm:jose@6';

const PORT = 54329;
const MOCK_URL = `http://localhost:${PORT}`;
const USER_ID = '11111111-1111-4111-8111-111111111111';
const EMAIL = 'me@example.com';

// ---- 偽サーバー（Anthropic の Messages API と Supabase の RPC） ----
type Recorded = { headers: Headers; body: Record<string, unknown> };
const claudeCalls: Recorded[] = [];
let usageCount = 0;
let claudeReply: () => Response = () => okReply('{"weekday":"月"}');

function okReply(text: string, stopReason = 'end_turn'): Response {
  return Response.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  });
}

const server = Deno.serve({ port: PORT, onListen: () => {} }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/v1/messages') {
    claudeCalls.push({ headers: req.headers, body: await req.json() });
    return claudeReply();
  }
  if (url.pathname === '/rest/v1/rpc/ai_usage_increment') {
    usageCount += 1;
    return Response.json(usageCount);
  }
  return new Response('not found', { status: 404 });
});

// ---- 署名鍵と環境変数 ----
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
const other = await generateKeyPair('ES256');

Deno.env.set('SUPABASE_URL', MOCK_URL);
Deno.env.set('SUPABASE_PUBLISHABLE_KEYS', JSON.stringify({ default: 'sb_publishable_test' }));
Deno.env.set('SUPABASE_SECRET_KEYS', JSON.stringify({ default: 'sb_secret_test' }));
Deno.env.set('SUPABASE_JWKS', JSON.stringify({ keys: [jwk] }));
Deno.env.set('ANTHROPIC_BASE_URL', MOCK_URL);

async function token(key: CryptoKey = privateKey, email = EMAIL): Promise<string> {
  return await new SignJWT({ email, role: 'authenticated', aal: 'aal1', session_id: 's1' })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })
    .setSubject(USER_ID)
    .setAudience('authenticated')
    .setIssuer(`${MOCK_URL}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

const { default: handler } = await import('./index.ts');

async function call(body: unknown, auth?: string, method = 'POST') {
  const headers: Record<string, string> = { 'content-type': 'application/json', apikey: 'sb_publishable_test' };
  if (auth) headers.authorization = `Bearer ${auth}`;
  const res = await handler.fetch(
    new Request('http://localhost/functions/v1/ai', {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
  );
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = JSON.parse(text);
  } catch {
    // CORS の事前確認などは本文が JSON でないことがある
  }
  return { status: res.status, headers: res.headers, json };
}

function reset(env: Record<string, string | undefined> = {}) {
  claudeCalls.length = 0;
  usageCount = 0;
  claudeReply = () => okReply('{"weekday":"月"}');
  const defaults: Record<string, string | undefined> = {
    ANTHROPIC_API_KEY: 'sk-ant-test',
    AI_ALLOWED_EMAILS: undefined,
    AI_DAILY_LIMIT: undefined,
    AI_MODEL: undefined,
    ...env,
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
}

function assertEquals(actual: unknown, expected: unknown, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label} expected ${e}, got ${a}`);
}

Deno.test.afterAll?.(() => server.shutdown());

Deno.test('ログインしていなければ 401 で、Claude は呼ばない', async () => {
  reset();
  const res = await call({ feature: 'test' });
  assertEquals(res.status, 401);
  assertEquals(claudeCalls.length, 0);
});

Deno.test('別の鍵で署名されたトークンは 401', async () => {
  reset();
  const res = await call({ feature: 'test' }, await token(other.privateKey));
  assertEquals(res.status, 401);
  assertEquals(claudeCalls.length, 0);
});

Deno.test('status: Claude を呼ばずに設定状況とモデルを返す', async () => {
  reset();
  const res = await call({ feature: 'status' }, await token());
  assertEquals(res.status, 200);
  assertEquals(res.json.data, { configured: true, model: 'claude-opus-5-5' });
  assertEquals(claudeCalls.length, 0);
  assertEquals(usageCount, 0, 'usage');
});

Deno.test('test: Claude を 1 回呼び、決まった形の JSON を返す', async () => {
  reset();
  const res = await call({ feature: 'test', today: '2026-11-16' }, await token());
  assertEquals(res.status, 200);
  assertEquals(res.json.data, { ok: true, model: 'claude-opus-5-5', reply: { weekday: '月' } });
  assertEquals(claudeCalls.length, 1);
  assertEquals(usageCount, 1, 'usage');
  const { headers, body } = claudeCalls[0];
  // SDK 1.x（API バージョン 2026-10-21）は API キーを Authorization: Bearer で送る
  assertEquals(headers.get('authorization'), 'Bearer sk-ant-test', 'api key header');
  assertEquals(body.model, 'claude-opus-5-5');
  assertEquals((body.output_config as any).effort, 'low');
  assertEquals((body.output_config as any).format.type, 'json_schema');
  assertEquals(body.fallbacks, 'default');
  if (!(headers.get('anthropic-beta') ?? '').includes('server-side-fallback-2026-07-01')) {
    throw new Error('missing fallback beta header: ' + headers.get('anthropic-beta'));
  }
  if (!String((body.messages as any)[0].content).includes('2026-11-16')) throw new Error('today not passed');
  if ('betas' in body) throw new Error('betas must be sent as a header, not in the body');
});

Deno.test('知らない機能名は 400 で、Claude は呼ばない', async () => {
  reset();
  for (const feature of ['unknown', 'constructor', '__proto__', 123]) {
    const res = await call({ feature }, await token());
    assertEquals(res.status, 400, String(feature));
    assertEquals(res.json.error.code, 'bad_request');
  }
  assertEquals(claudeCalls.length, 0);
});

Deno.test('AI_ALLOWED_EMAILS にないアカウントは 403', async () => {
  reset({ AI_ALLOWED_EMAILS: 'someone@example.com' });
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 403);
  assertEquals(res.json.error.code, 'not_allowed');
  assertEquals(claudeCalls.length, 0);
  assertEquals(usageCount, 0, 'usage');
});

Deno.test('AI_ALLOWED_EMAILS は大文字小文字と空白を区別しない', async () => {
  reset({ AI_ALLOWED_EMAILS: ' other@example.com , ME@Example.com ' });
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 200);
});

Deno.test('1 日の上限を超えたら 429 で、Claude は呼ばない', async () => {
  reset({ AI_DAILY_LIMIT: '2' });
  const t = await token();
  assertEquals((await call({ feature: 'test' }, t)).status, 200);
  assertEquals((await call({ feature: 'test' }, t)).status, 200);
  const third = await call({ feature: 'test' }, t);
  assertEquals(third.status, 429);
  assertEquals(third.json.error.code, 'daily_limit');
  assertEquals(claudeCalls.length, 2);
});

Deno.test('Claude が断ったら ai_refused', async () => {
  reset();
  claudeReply = () => okReply('', 'refusal');
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 422);
  assertEquals(res.json.error.code, 'ai_refused');
});

Deno.test('API キーが無効なら not_configured（キーや詳細は返さない）', async () => {
  reset();
  claudeReply = () =>
    Response.json(
      { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
      { status: 401 },
    );
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 503);
  assertEquals(res.json.error.code, 'not_configured');
  if (JSON.stringify(res.json).includes('sk-ant')) throw new Error('leaked key');
});

Deno.test('API キーが未設定なら、status は未設定と答え、test は not_configured', async () => {
  reset({ ANTHROPIC_API_KEY: undefined });
  const t = await token();
  assertEquals((await call({ feature: 'status' }, t)).json.data.configured, false);
  const res = await call({ feature: 'test' }, t);
  assertEquals(res.status, 503);
  assertEquals(res.json.error.code, 'not_configured');
});

Deno.test('Claude が JSON 以外を返したら ai_failed', async () => {
  reset();
  claudeReply = () => okReply('すみません');
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 502);
  assertEquals(res.json.error.code, 'ai_failed');
});

Deno.test('サーバー側のやり直しに対応しないモデルでは fallbacks を送らない', async () => {
  reset({ AI_MODEL: 'claude-haiku-5-5' });
  const res = await call({ feature: 'test' }, await token());
  assertEquals(res.status, 200);
  assertEquals(claudeCalls[0].body.model, 'claude-haiku-5-5');
  if ('fallbacks' in claudeCalls[0].body) throw new Error('fallbacks should be omitted');
});

Deno.test('ブラウザの事前確認（OPTIONS）に CORS の許可を返す', async () => {
  reset();
  const res = await call(undefined, undefined, 'OPTIONS');
  if (!res.headers.get('access-control-allow-origin')) throw new Error('no CORS header');
  if (!(res.headers.get('access-control-allow-headers') ?? '').toLowerCase().includes('authorization')) {
    throw new Error('authorization header not allowed');
  }
});

Deno.test('不正な JSON の本文は 400', async () => {
  reset();
  const res = await handler.fetch(
    new Request('http://localhost/functions/v1/ai', {
      method: 'POST',
      headers: { authorization: `Bearer ${await token()}`, apikey: 'sb_publishable_test' },
      body: '{not json',
    }),
  );
  assertEquals(res.status, 400);
});

// ---------------------------------------------------------------------------
// quick_add（文章からタスク・家計簿の下書きを作る）
// ---------------------------------------------------------------------------

const { normalizeDrafts } = await import('./index.ts');

function claudeJson(value: unknown) {
  return () => okReply(JSON.stringify(value));
}

const blank = { title: '', note: '', due_date: null, priority: 'medium', amount: null, date: null, category: null };

Deno.test('quick_add: 文章と今日の日付・曜日を渡し、下書きを返す', async () => {
  reset();
  claudeReply = claudeJson({
    items: [
      { ...blank, kind: 'task', title: '歯医者を予約する', due_date: '2026-11-20', priority: 'high' },
      { ...blank, kind: 'expense', title: 'ランチ', amount: 980, date: '2026-11-16', category: 'food' },
    ],
  });
  const res = await call(
    { feature: 'quick_add', today: '2026-11-16', input: { text: '金曜までに歯医者を予約、ランチ980円' } },
    await token(),
  );
  assertEquals(res.status, 200);
  assertEquals(res.json.data.items, [
    { kind: 'task', title: '歯医者を予約する', note: '', dueDate: '2026-11-20', priority: 'high' },
    { kind: 'expense', amount: 980, date: '2026-11-16', category: 'food', note: 'ランチ' },
  ]);
  const body = claudeCalls[0].body;
  const system = String(body.system);
  if (!system.includes('2026-11-16（月曜日）')) throw new Error('today/weekday missing in system prompt');
  if (!system.includes('food（食費）') || !system.includes('salary（給与）')) throw new Error('categories missing');
  const user = String((body.messages as any)[0].content);
  if (!user.includes('<text>\n金曜までに歯医者を予約、ランチ980円\n</text>')) throw new Error('user text not wrapped');
  const schema = (body.output_config as any).format.schema;
  assertEquals(schema.required, ['items']);
  assertEquals(usageCount, 1, 'usage');
});

Deno.test('quick_add: 文章が空・長すぎる・文字列でないときは 400 で、回数も数えない', async () => {
  reset();
  const t = await token();
  for (const input of [undefined, {}, { text: '' }, { text: '   ' }, { text: 123 }, { text: 'あ'.repeat(1001) }]) {
    const res = await call({ feature: 'quick_add', input }, t);
    assertEquals(res.status, 400, JSON.stringify(input)?.slice(0, 30));
    assertEquals(res.json.error.code, 'bad_request');
  }
  assertEquals(claudeCalls.length, 0);
  assertEquals(usageCount, 0, 'usage');
});

Deno.test('quick_add: ちょうど 1000 文字は受け付ける', async () => {
  reset();
  claudeReply = claudeJson({ items: [] });
  const res = await call({ feature: 'quick_add', input: { text: 'あ'.repeat(1000) } }, await token());
  assertEquals(res.status, 200);
  assertEquals(res.json.data.items, []);
});

Deno.test('normalizeDrafts: 形の合わない項目を捨て、足りない値を補う', () => {
  const today = '2026-11-16';
  const drafts = normalizeDrafts(
    {
      items: [
        { ...blank, kind: 'task', title: '  牛乳を買う  ', note: ' 2本 ', due_date: '2026-02-30', priority: 'urgent' },
        { ...blank, kind: 'task', title: '   ' },
        { ...blank, kind: 'expense', title: '電車', amount: 220, date: null, category: 'transport' },
        { ...blank, kind: 'expense', title: '謎', amount: 500, date: '2026-11-15', category: 'salary', note: '' },
        { ...blank, kind: 'income', title: '給料', amount: 250000, date: '2026-11-25', category: 'salary' },
        { ...blank, kind: 'income', title: 'お祝い', amount: 10000, category: 'gift' },
        { ...blank, kind: 'expense', title: '0円', amount: 0 },
        { ...blank, kind: 'expense', title: '小数', amount: 12.5 },
        { ...blank, kind: 'expense', title: '大きすぎ', amount: 10_000_001 },
        { ...blank, kind: 'expense', title: '文字の金額', amount: '980' },
        { ...blank, kind: 'transfer', title: '?', amount: 100 },
        null,
        'text',
      ],
    },
    today,
  );
  assertEquals(drafts, [
    { kind: 'task', title: '牛乳を買う', note: '2本', dueDate: null, priority: 'medium' },
    { kind: 'expense', amount: 220, date: today, category: 'transport', note: '電車' },
    { kind: 'expense', amount: 500, date: '2026-11-15', category: 'other', note: '謎' },
    { kind: 'income', amount: 250000, date: '2026-11-25', category: 'salary', note: '給料' },
    { kind: 'income', amount: 10000, date: today, category: 'other_income', note: 'お祝い' },
  ]);
});

Deno.test('normalizeDrafts: 長すぎる文字は切り詰め、最大 10 件まで', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ ...blank, kind: 'task', title: `t${i}` }));
  assertEquals(normalizeDrafts({ items: many }, '2026-11-16').length, 10);
  const [long] = normalizeDrafts({ items: [{ ...blank, kind: 'task', title: 'あ'.repeat(150), note: 'い'.repeat(300) }] }, '2026-11-16');
  assertEquals([(long as any).title.length, (long as any).note.length], [100, 200]);
  assertEquals(normalizeDrafts({ items: 'x' }, '2026-11-16'), []);
  assertEquals(normalizeDrafts(null, '2026-11-16'), []);
});
