import { Alert, Platform } from 'react-native';

type Options = {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/** 取り消せない操作の前に確認する。 */
export function confirmDestructive({ title, message, confirmLabel, onConfirm }: Options): void {
  if (Platform.OS === 'web') {
    // Alert.alert は Web では動作しないため、ブラウザ標準の確認ダイアログを使う
    if (globalThis.confirm([title, message].filter(Boolean).join('\n'))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'キャンセル', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
