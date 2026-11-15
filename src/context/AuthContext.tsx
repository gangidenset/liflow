import type { AuthError, Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { supabase, WEB_APP_URL } from '@/lib/supabase';

export const MIN_PASSWORD_LENGTH = 8;

/** 認証の失敗を、利用者向けの日本語にする */
export function describeAuthError(error: unknown): string {
  const authError = error as Partial<AuthError> | null;
  switch (authError?.code) {
    case 'invalid_credentials':
      return 'メールアドレスまたはパスワードが違います。';
    case 'email_not_confirmed':
      return '確認メールのリンクを開いて、登録を完了してください。';
    case 'user_already_exists':
    case 'email_exists':
      return 'このメールアドレスはすでに登録されています。ログインしてください。';
    case 'weak_password':
      return `パスワードが簡単すぎます。${MIN_PASSWORD_LENGTH} 文字以上で、推測されにくいものにしてください。`;
    case 'email_address_invalid':
    case 'validation_failed':
      return 'メールアドレスの形式が正しくありません。';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return '短い間に何度も操作されました。しばらく待ってからお試しください。';
    case 'same_password':
      return '今と同じパスワードは使えません。';
    case 'session_not_found':
    case 'session_expired':
      return 'リンクの有効期限が切れています。もう一度メールを送ってください。';
  }
  if (authError?.name === 'AuthRetryableFetchError' || authError?.status === 0) {
    return '通信できませんでした。電波のよい場所で、もう一度お試しください。';
  }
  return '処理できませんでした。時間をおいて、もう一度お試しください。';
}

type AuthContextValue = {
  /** クラウド同期の接続情報が設定されているか */
  isAvailable: boolean;
  /** 保存済みのログイン状態の確認が終わったか */
  isReady: boolean;
  session: Session | null;
  /** パスワード再設定のリンクから開いた状態か（Web 版） */
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** 新規登録。確認メールを送った場合は true（その場合、リンクを開くまでログインできない） */
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  /** この端末だけログアウトする（通信できなくてもログアウトできる） */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(supabase === null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .catch((error: unknown) => console.warn('Failed to restore session', error))
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  // iOS・Android では、アプリが前面にあるときだけログイン状態を自動更新する（公式の推奨）
  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const update = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    update(AppState.currentState ?? 'active');
    const subscription = AppState.addEventListener('change', update);
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('not configured');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('not configured');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${WEB_APP_URL}/` },
    });
    if (error) throw error;
    return { needsConfirmation: data.session === null };
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!supabase) throw new Error('not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${WEB_APP_URL}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) throw new Error('not configured');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setIsPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      isAvailable: supabase !== null,
      isReady,
      session,
      isPasswordRecovery,
      signIn,
      signUp,
      sendPasswordReset,
      updatePassword,
      signOut,
    }),
    [isReady, session, isPasswordRecovery, signIn, signUp, sendPasswordReset, updatePassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth は AuthProvider の内側で使用してください');
  return value;
}
