import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { LedgerProvider } from '@/context/LedgerContext';
import { SyncProvider } from '@/context/SyncContext';
import { TaskProvider } from '@/context/TaskContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TaskProvider>
          <LedgerProvider>
            <SyncProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.surface },
                  headerTintColor: colors.primary,
                  headerTitleStyle: { color: colors.text },
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="task-editor"
                  options={{ presentation: 'modal', title: 'タスクを追加', headerBackTitle: '戻る' }}
                />
                <Stack.Screen
                  name="ledger-editor"
                  options={{ presentation: 'modal', title: '記録を追加', headerBackTitle: '戻る' }}
                />
                <Stack.Screen
                  name="budget-editor"
                  options={{ presentation: 'modal', title: '予算の設定', headerBackTitle: '戻る' }}
                />
                <Stack.Screen
                  name="login"
                  options={{ presentation: 'modal', title: 'ログイン', headerBackTitle: '戻る' }}
                />
                <Stack.Screen name="reset-password" options={{ title: 'パスワードの再設定' }} />
              </Stack>
            </SyncProvider>
          </LedgerProvider>
        </TaskProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
