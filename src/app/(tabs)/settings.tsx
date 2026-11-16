import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { callAi, describeAiError } from '@/ai/aiClient';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { cardShadow, colors, fontSize, radius, spacing } from '@/theme';
import { confirmDestructive } from '@/utils/confirm';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 例: 11月15日（日） 10:05 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}） ${hh}:${mm}`;
}

export default function SettingsScreen() {
  const { isAvailable, isReady, session } = useAuth();
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="設定" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>アカウントと同期</Text>
        {!isAvailable ? (
          <View style={styles.card}>
            <Text style={styles.body}>
              このアプリではクラウド同期が設定されていません。データはこの端末の中だけに保存されます。
            </Text>
          </View>
        ) : !isReady ? null : session ? (
          <SignedInCard email={session.user.email ?? ''} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              ログインすると、タスクと家計簿をアカウントに保存して、複数の端末で同じデータを使えます。ログインしなくても、この端末の中だけでこれまでどおり使えます。
            </Text>
            <Button label="ログイン / 新規登録" onPress={() => router.push('/login')} />
          </View>
        )}

        {isAvailable && isReady && session ? (
          <>
            <Text style={styles.sectionTitle}>AI 機能</Text>
            <AiCard />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>このアプリについて</Text>
        <View style={styles.card}>
          <Text style={styles.body}>AI LIFE MANAGER Lite</Text>
          {version ? <Text style={styles.caption}>バージョン {version}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function SignedInCard({ email }: { email: string }) {
  const { status, lastSyncedAt, errorMessage, pendingCount, syncNow, logout } = useSync();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const doLogout = async (force: boolean) => {
    setIsLoggingOut(true);
    try {
      const result = await logout({ force });
      if (result === 'unsynced') {
        confirmDestructive({
          title: 'まだ送っていない変更があります',
          message:
            '通信できないため、この端末の変更をアカウントに保存できませんでした。このままログアウトすると、その変更は失われます。',
          confirmLabel: 'ログアウトする',
          onConfirm: () => void doLogout(true),
        });
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const confirmLogout = () =>
    confirmDestructive({
      title: 'ログアウトしますか？',
      message:
        'この端末のタスクと家計簿を消します。データはアカウントに保存されているので、もう一度ログインすると戻ります。',
      confirmLabel: 'ログアウト',
      onConfirm: () => void doLogout(false),
    });

  const statusText =
    status === 'syncing'
      ? '同期中…'
      : lastSyncedAt
        ? `最終同期: ${formatDateTime(lastSyncedAt)}`
        : 'まだ同期していません';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>ログイン中</Text>
        <Text style={styles.value} numberOfLines={1}>
          {email}
        </Text>
      </View>
      <Text style={styles.caption} accessibilityLiveRegion="polite">
        {statusText}
        {status !== 'syncing' && pendingCount > 0 ? `（未送信の変更 ${pendingCount} 件）` : ''}
      </Text>
      {status === 'error' && errorMessage ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errorMessage}
        </Text>
      ) : null}
      <Button
        label="今すぐ同期"
        variant="secondary"
        loading={status === 'syncing'}
        onPress={() => void syncNow()}
      />
      <Button
        label="ログアウト"
        variant="danger"
        loading={isLoggingOut}
        onPress={confirmLogout}
      />
    </View>
  );
}

/** AI 機能の接続テスト（サーバーの準備ができているかを確かめる） */
function AiCard() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const test = async () => {
    setIsTesting(true);
    setResult(null);
    try {
      const data = await callAi<{ ok: boolean; model: string }>('test');
      setResult({ ok: true, message: `AI と接続できました（モデル: ${data.model}）` });
    } catch (error) {
      setResult({ ok: false, message: describeAiError(error) });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.body}>
        AI 機能は、タスクや家計簿の内容をサーバー経由で AI（Claude）に送って処理します。
      </Text>
      {result ? (
        <Text
          style={result.ok ? styles.success : styles.error}
          accessibilityRole={result.ok ? undefined : 'alert'}
          accessibilityLiveRegion="polite"
        >
          {result.message}
        </Text>
      ) : null}
      <Button label="AI の接続テスト" variant="secondary" loading={isTesting} onPress={() => void test()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    ...cardShadow,
  },
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  caption: { fontSize: fontSize.caption, lineHeight: 20, color: colors.textSecondary },
  error: { fontSize: fontSize.caption, lineHeight: 20, color: colors.danger },
  success: { fontSize: fontSize.caption, lineHeight: 20, color: colors.success },
  row: { gap: spacing.xs },
  label: { fontSize: fontSize.caption, fontWeight: '600', color: colors.textSecondary },
  value: { fontSize: fontSize.body, fontWeight: '600', color: colors.text },
});
