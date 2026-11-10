import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LedgerProvider } from '@/context/LedgerContext';
import { TaskProvider } from '@/context/TaskContext';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TaskProvider>
        <LedgerProvider>
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
          </Stack>
        </LedgerProvider>
      </TaskProvider>
    </SafeAreaProvider>
  );
}
