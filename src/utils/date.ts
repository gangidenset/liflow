const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** 例: 2026年11月10日（火） */
export function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}

/** Date を端末ローカルの 'YYYY-MM-DD' に変換する。 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD' を端末ローカルの 0 時の Date に変換する。 */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** to が from の何日後か（過去なら負の値）。 */
export function diffInDays(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export type DueStatus = 'overdue' | 'today' | 'tomorrow' | 'later';

export function getDueStatus(dueDate: string, todayKey: string): DueStatus {
  const diff = diffInDays(todayKey, dueDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return 'later';
}

/** 例: 11月12日（木）。今年以外は年も付ける。 */
export function formatDateKey(key: string, todayKey: string): string {
  const date = fromDateKey(key);
  const label = `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
  return key.slice(0, 4) === todayKey.slice(0, 4) ? label : `${date.getFullYear()}年${label}`;
}

/** タスク行に表示する期限ラベル。 */
export function formatDueLabel(dueDate: string, todayKey: string): string {
  switch (getDueStatus(dueDate, todayKey)) {
    case 'overdue':
      return `期限切れ ${formatDateKey(dueDate, todayKey)}`;
    case 'today':
      return '今日まで';
    case 'tomorrow':
      return '明日まで';
    default:
      return formatDateKey(dueDate, todayKey);
  }
}
