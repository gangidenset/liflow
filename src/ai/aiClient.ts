import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { toDateKey } from '@/utils/date';

/** サーバー（supabase/functions/ai）が返す失敗の種類。通信できない場合は 'network' */
export type AiErrorCode =
  | 'bad_request'
  | 'not_allowed'
  | 'not_configured'
  | 'daily_limit'
  | 'ai_busy'
  | 'ai_refused'
  | 'ai_failed'
  | 'not_signed_in'
  | 'network';

export class AiRequestError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(`AI request failed: ${code}`);
  }
}

const KNOWN_CODES: readonly AiErrorCode[] = [
  'bad_request',
  'not_allowed',
  'not_configured',
  'daily_limit',
  'ai_busy',
  'ai_refused',
  'ai_failed',
];

/** 失敗の種類を、利用者向けの日本語にする */
export function describeAiError(error: unknown): string {
  const code = error instanceof AiRequestError ? error.code : 'ai_failed';
  switch (code) {
    case 'not_signed_in':
      return 'AI 機能を使うには、設定タブからログインしてください。';
    case 'not_allowed':
      return 'このアカウントでは AI 機能を使えません。';
    case 'not_configured':
      return 'AI 機能の準備が終わっていません（サーバーに API キーが設定されていないか、無効です）。';
    case 'daily_limit':
      return '今日の AI の利用回数の上限に達しました。明日またお試しください。';
    case 'ai_busy':
      return 'AI が混み合っています。少し待ってから、もう一度お試しください。';
    case 'ai_refused':
      return 'この内容は AI で処理できませんでした。言い方を変えてお試しください。';
    case 'network':
      return '通信できませんでした。電波のよい場所で、もう一度お試しください。';
    default:
      return 'AI の処理に失敗しました。時間をおいて、もう一度お試しください。';
  }
}

/** supabase.functions.invoke の失敗から、失敗の種類を取り出す */
export async function toAiError(error: unknown): Promise<AiRequestError> {
  if (error instanceof FunctionsHttpError) {
    const response = error.context as { status?: number; json?: () => Promise<unknown> } | undefined;
    try {
      const body = (await response?.json?.()) as { error?: { code?: unknown } } | undefined;
      const code = body?.error?.code;
      if (typeof code === 'string' && (KNOWN_CODES as readonly string[]).includes(code)) {
        return new AiRequestError(code as AiErrorCode);
      }
    } catch {
      // 本文が JSON でない（関数の外でのエラーなど）
    }
    if (response?.status === 401) return new AiRequestError('not_signed_in');
    return new AiRequestError('ai_failed');
  }
  if (error instanceof FunctionsFetchError) return new AiRequestError('network');
  return new AiRequestError('ai_failed');
}

/**
 * サーバーの AI 機能を呼ぶ。ログインしていなければ not_signed_in。
 * 機能の名前と入力だけを送り、AI へのお願い文はサーバー側で決める。
 */
export async function callAi<T>(feature: string, input?: unknown): Promise<T> {
  if (!supabase) throw new AiRequestError('not_configured');
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new AiRequestError('not_signed_in');

  const { data, error } = await supabase.functions.invoke<{ data: T }>('ai', {
    body: { feature, input, today: toDateKey(new Date()) },
  });
  if (error) throw await toAiError(error);
  if (!data || typeof data !== 'object' || !('data' in data)) throw new AiRequestError('ai_failed');
  return data.data;
}
