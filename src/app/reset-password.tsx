import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { describeAuthError, MIN_PASSWORD_LENGTH, useAuth } from '@/context/AuthContext';
import { colors, fontSize, MIN_TOUCH, radius, spacing } from '@/theme';

/**
 * パスワード再設定メールのリンク先（Web 版）。
 * リンクを開くと一時的にログインした状態になるので、新しいパスワードを設定してもらう。
 */
export default function ResetPasswordScreen() {
  const { isAvailable, isReady, session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは ${MIN_PASSWORD_LENGTH} 文字以上にしてください。`);
      return;
    }
    if (password !== confirmation) {
      setError('確認用のパスワードが一致しません。');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await updatePassword(password);
      setIsDone(true);
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const goHome = () => router.replace('/');

  let content;
  if (!isAvailable) {
    content = <Text style={styles.description}>このアプリではクラウド同期が設定されていません。</Text>;
  } else if (!isReady) {
    content = <ActivityIndicator color={colors.primary} />;
  } else if (isDone) {
    content = (
      <>
        <Text style={styles.description}>
          パスワードを変更しました。他の端末では、新しいパスワードでログインしてください。
        </Text>
        <Button label="アプリを開く" onPress={goHome} />
      </>
    );
  } else if (!session) {
    content = (
      <>
        <Text style={styles.description}>
          リンクが無効か、有効期限が切れています。アプリのログイン画面から、再設定メールをもう一度送ってください。
        </Text>
        <Button label="アプリを開く" onPress={goHome} />
      </>
    );
  } else {
    content = (
      <>
        <Text style={styles.description}>
          {session.user.email} の新しいパスワードを設定してください。
        </Text>
        <View style={styles.group}>
          <Text style={styles.label}>新しいパスワード</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`${MIN_PASSWORD_LENGTH} 文字以上`}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="新しいパスワード"
            style={styles.input}
          />
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>新しいパスワード（確認）</Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            accessibilityLabel="新しいパスワード（確認）"
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button label="パスワードを変更" loading={isSubmitting} onPress={() => void submit()} />
      </>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'パスワードの再設定' }} />
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  description: { fontSize: 15, lineHeight: 22, color: colors.text },
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
});
