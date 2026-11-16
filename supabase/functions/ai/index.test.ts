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
