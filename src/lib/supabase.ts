import './polyfills';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// 公開して問題のない接続情報（Supabase の「publishable key」）。
// 管理用の secret key は絶対にここへ書かないこと（アプリに組み込まれ、誰でも読めるため）。
// 値は .env.local（手元）や GitHub の Actions 変数（Web 版の自動公開）で渡す。
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Web 版の公開アドレス（確認メール・パスワード再設定メールのリンク先） */
export const WEB_APP_URL = (
  process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://gangidenset.github.io/liflow'
).replace(/\/+$/, '');

/**
 * Supabase のクライアント。接続情報が設定されていなければ null
 * （その場合、ログインと同期の機能は表示せず、端末内だけで動く）。
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // 確認メール・再設定メールのリンクは Web 版で開くため、Web 版だけ URL からログイン状態を読む
          detectSessionInUrl: Platform.OS === 'web',
          // メールのリンクを、送信を依頼した端末とは別のブラウザで開いても使えるようにする
          flowType: 'implicit',
        },
      })
    : null;

export const isCloudSyncAvailable = supabase !== null;
