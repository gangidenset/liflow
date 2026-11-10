import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
};

export function EmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  message: {
    fontSize: fontSize.caption,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
