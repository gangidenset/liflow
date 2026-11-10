import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toDateKey } from '@/utils/date';

/** 今日の日付キー。アプリを開いたまま日付が変わっても追従する。 */
export function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const refresh = () => setTodayKey(toDateKey(new Date()));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  return todayKey;
}
