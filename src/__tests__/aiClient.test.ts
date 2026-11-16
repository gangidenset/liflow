import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { AiRequestError, describeAiError, toAiError } from '@/ai/aiClient';

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError({
    status,
    json: async () => {
      if (body === undefined) throw new Error('not json');
      return body;
    },
  });
}

describe('toAiError', () => {
  it('サーバーが返した失敗の種類を取り出す', async () => {
    const error = await toAiError(httpError(429, { error: { code: 'daily_limit', message: 'x' } }));
    expect(error).toBeInstanceOf(AiRequestError);
    expect(error.code).toBe('daily_limit');
  });

  it('知らない種類は ai_failed にする', async () => {
    expect((await toAiError(httpError(500, { error: { code: 'something_new' } }))).code).toBe(
      'ai_failed',
    );
  });

  it('本文が JSON でない 401 は「ログインしていない」扱い', async () => {
    expect((await toAiError(httpError(401, undefined))).code).toBe('not_signed_in');
  });

  it('通信できなかった場合は network', async () => {
    expect((await toAiError(new FunctionsFetchError(new Error('offline')))).code).toBe('network');
  });

  it('想定外の失敗は ai_failed', async () => {
    expect((await toAiError(new Error('boom'))).code).toBe('ai_failed');
  });
});

describe('describeAiError', () => {
  it('種類ごとに日本語の案内を返す', () => {
    expect(describeAiError(new AiRequestError('daily_limit'))).toMatch(/上限/);
    expect(describeAiError(new AiRequestError('not_signed_in'))).toMatch(/ログイン/);
    expect(describeAiError(new AiRequestError('network'))).toMatch(/通信/);
    expect(describeAiError(new Error('x'))).toMatch(/失敗しました/);
  });
});
