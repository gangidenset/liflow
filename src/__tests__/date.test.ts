import {
  diffInDays,
  formatDateKey,
  formatDueLabel,
  formatFullDate,
  fromDateKey,
  getDueStatus,
  toDateKey,
} from '@/utils/date';

describe('toDateKey / fromDateKey', () => {
  it('端末ローカルの日付を YYYY-MM-DD にする', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 10, 10, 0, 0))).toBe('2026-11-10');
  });

  it('相互に変換しても日付が変わらない', () => {
    for (const key of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
      expect(toDateKey(fromDateKey(key))).toBe(key);
    }
  });
});

describe('diffInDays', () => {
  it('同じ日は 0、未来は正、過去は負', () => {
    expect(diffInDays('2026-11-10', '2026-11-10')).toBe(0);
    expect(diffInDays('2026-11-10', '2026-11-11')).toBe(1);
    expect(diffInDays('2026-11-10', '2026-11-08')).toBe(-2);
  });

  it('月・年・うるう日をまたいで数えられる', () => {
    expect(diffInDays('2026-01-31', '2026-02-01')).toBe(1);
    expect(diffInDays('2026-12-31', '2027-01-01')).toBe(1);
    expect(diffInDays('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('getDueStatus', () => {
  const today = '2026-11-10';
  it.each([
    ['2026-11-09', 'overdue'],
    ['2025-12-31', 'overdue'],
    ['2026-11-10', 'today'],
    ['2026-11-11', 'tomorrow'],
    ['2026-11-12', 'later'],
  ])('%s は %s', (dueDate, expected) => {
    expect(getDueStatus(dueDate, today)).toBe(expected);
  });
});

describe('表示用の整形', () => {
  const today = '2026-11-10';

  it('formatFullDate は年月日と曜日を出す', () => {
    expect(formatFullDate(new Date(2026, 10, 10))).toBe('2026年11月10日（火）');
  });

  it('formatDateKey は今年なら年を省き、別の年なら年を付ける', () => {
    expect(formatDateKey('2026-11-20', today)).toBe('11月20日（金）');
    expect(formatDateKey('2027-01-01', today)).toBe('2027年1月1日（金）');
  });

  it('formatDueLabel は期限の近さに応じたラベルを返す', () => {
    expect(formatDueLabel('2026-11-08', today)).toBe('期限切れ 11月8日（日）');
    expect(formatDueLabel('2026-11-10', today)).toBe('今日まで');
    expect(formatDueLabel('2026-11-11', today)).toBe('明日まで');
    expect(formatDueLabel('2026-11-20', today)).toBe('11月20日（金）');
  });
});
