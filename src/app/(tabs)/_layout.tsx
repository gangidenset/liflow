import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export default function TabLayout() {
  // ラベルを読みやすい大きさにするため、タブバーの高さを明示する（下部セーフエリア込み）
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={focused ? colors.primary : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'タスク一覧',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={size} color={focused ? colors.primary : colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: '家計簿',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={focused ? colors.primary : colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
