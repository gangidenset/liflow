const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 例: 2026年11月10日（火） */
export function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}
