import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { describeAuthError, MIN_PASSWORD_LENGTH, useAuth } from '@/context/AuthContext';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

type Mode = 'signIn' | 'signUp' | 'reset';

const TITLES: Record<Mode, string> = {
  signIn: 'ログイン',
  signUp: '新規登録',
  reset: 'パスワードの再設定',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ログイン・新規登録・パスワード再設定メールの送信 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { isAvailable, signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword('');
  };

  const validate = (): string | null => {
    if (!EMAIL_PATTERN.test(email.trim())) return 'メールアドレスを正しく入力してください。';
    if (mode === 'signIn' && password.length === 0) return 'パスワードを入力してください。';
    if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
      return `パスワードは ${MIN_PASSWORD_LENGTH} 文字以上にしてください。`;
    }
    return null;
  };

  const submit = async () => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
        router.back();
        return;
      }
      if (mode === 'signUp') {
        const { needsConfirmation } = await signUp(email, password);
        if (!needsConfirmation) {
          router.back();
          return;
        }
        setMode('signIn');
        setPassword('');
        setNotice(
          '確認メールを送りました。メールのリンクを開いて登録を完了してから、ログインしてください。',
        );
        return;
      }
      await sendPasswordReset(email);
      setMode('signIn');
      setNotice(
        'パスワード再設定のメールを送りました。メールのリンクを開いて新しいパスワードを設定してから、ログインしてください。',
      );
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAvailable) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Stack.Screen options={{ title: 'ログイン' }} />
        <Text style={styles.description}>このアプリではクラウド同期が設定されていません。</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Stack.Screen options={{ title: TITLES[mode] }} />

      {mode === 'signUp' ? (
        <Text style={styles.description}>
          登録すると、この端末のタスクと家計簿をアカウントに保存して、他の端末でも使えるようになります。
        </Text>
      ) : null}
      {mode === 'reset' ? (
        <Text style={styles.description}>
          登録したメールアドレスに、パスワードを設定し直すためのリンクを送ります。
        </Text>
      ) : null}

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.group}>
        <Text style={styles.label}>メールアドレス</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          accessibilityLabel="メールアドレス"
          style={styles.input}
        />
      </View>

      {mode !== 'reset' ? (
        <View style={styles.group}>
          <Text style={styles.label}>パスワード</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signUp' ? `${MIN_PASSWORD_LENGTH} 文字以上` : ''}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            accessibilityLabel="パスワード"
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button
        label={
          mode === 'signIn' ? 'ログイン' : mode === 'signUp' ? '登録する' : '再設定メールを送る'
        }
        loading={isSubmitting}
        onPress={() => void submit()}
      />

      <View style={styles.links}>
        {mode === 'signIn' ? (
          <>
            <Button
              variant="link"
              label="アカウントをお持ちでない方は新規登録"
              onPress={() => switchMode('signUp')}
            />
            <Button
              variant="link"
              label="パスワードを忘れた場合"
              onPress={() => switchMode('reset')}
            />
          </>
        ) : (
          <Button variant="link" label="ログインに戻る" onPress={() => switchMode('signIn')} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  description: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  notice: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  noticeText: { fontSize: 15, lineHeight: 22, color: colors.primary },
  group: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: '700', color: colors.text },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  error: { fontSize: fontSize.caption, lineHeight: 20, color: colors.danger },
  links: { gap: spacing.xs },
});
