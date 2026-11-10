import { Platform } from 'react-native';

export const colors = {
  background: '#F4F5F9',
  surface: '#FFFFFF',
  text: '#161A2B',
  textSecondary: '#5C637A',
  textMuted: '#8D93A6',
  border: '#E3E5EE',
  primary: '#4353D8',
  primarySoft: '#E8EAFC',
  onPrimary: '#FFFFFF',
  success: '#1E9E6A',
  danger: '#D93A3A',
  dangerSoft: '#FCE9E9',
  warning: '#D9790B',
  warningSoft: '#FDF0DF',
  priorityHigh: '#D93A3A',
  priorityMedium: '#D9A00B',
  priorityLow: '#3B82D6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 13,
  body: 16,
  subtitle: 18,
  title: 22,
  display: 28,
} as const;

/** 押しやすさを確保するための最小タップ領域 */
export const MIN_TOUCH = 48;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#1B2140',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 2 },
  default: {},
});
