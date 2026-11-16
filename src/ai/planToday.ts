import { callAi } from '@/ai/aiClient';
import type { Priority, Task } from '@/types/task';
import { diffInDays } from '@/utils/date';
import { isTodayTask, sortTasks } from '@/utils/taskSort';

/** AI に渡す候補の上限（サーバー側と同じ） */
export const PLAN_MAX_CANDIDATES = 30;
/** 量の目安として渡す「今日の予定」の上限（サーバー側と同じ） */
export const PLAN_MAX_TODAY = 20;
/** これより先に期限が来るタスクは候補にしない（日数） */
export const PLAN_LOOKAHEAD_DAYS = 14;
const NOTE_MAX = 100;

type PlanTask = { title: string; note: string; dueDate: string | null; priority: Priority };

/**
 * 提案の候補にするタスク: 未完了・未削除で、今日の一覧にまだ入っておらず、
 * 期限がないか、期限が 14 日以内のもの。期限・優先度の順に並べ、上限まで。
 */
export function selectCandidates(tasks: readonly Task[], todayKey: string): Task[] {
  return sortTasks(
    tasks.filter(
      (task) =>
        !task.completed &&
        task.deletedAt === null &&
        !isTodayTask(task, todayKey) &&
        (task.dueDate === null || diffInDays(todayKey, task.dueDate) <= PLAN_LOOKAHEAD_DAYS),
    ),
  ).slice(0, PLAN_MAX_CANDIDATES);
}

/** すでに今日やる予定の未完了タスク（AI に量の目安として伝える） */
export function selectTodayTasks(tasks: readonly Task[], todayKey: string): Task[] {
  return sortTasks(
    tasks.filter((task) => !task.completed && task.deletedAt === null && isTodayTask(task, todayKey)),
  ).slice(0, PLAN_MAX_TODAY);
}

function toPlanTask(task: Task): PlanTask {
  return {
    title: task.title,
    note: task.note.slice(0, NOTE_MAX),
    dueDate: task.dueDate,
    priority: task.priority,
  };
}

export type PlanSuggestion = { task: Task; reason: string };
export type PlanResult = { message: string; suggestions: PlanSuggestion[] };

/** サーバーの答え（番号つき）を、候補のタスクに対応づける。不正・重複は捨てる */
export function mapPlan(raw: unknown, candidates: readonly Task[]): PlanResult {
  const v = (raw ?? {}) as { message?: unknown; suggestions?: unknown };
  const seen = new Set<number>();
  const suggestions: PlanSuggestion[] = [];
  for (const item of Array.isArray(v.suggestions) ? v.suggestions : []) {
    const s = (item ?? {}) as { n?: unknown; reason?: unknown };
    if (typeof s.n !== 'number' || !Number.isInteger(s.n) || seen.has(s.n)) continue;
    const task = candidates[s.n - 1];
    if (!task) continue;
    seen.add(s.n);
    suggestions.push({ task, reason: typeof s.reason === 'string' ? s.reason : '' });
  }
  return { message: typeof v.message === 'string' ? v.message : '', suggestions };
}

/** 今日やることを AI に提案してもらう。候補はタスクの並び順の番号（1 始まり）で受け渡す */
export async function requestPlanToday(candidates: readonly Task[], todayTasks: readonly Task[]): Promise<PlanResult> {
  const data = await callAi<unknown>('plan_today', {
    candidates: candidates.map((task, index) => ({ n: index + 1, ...toPlanTask(task) })),
    today: todayTasks.map(toPlanTask),
  });
  return mapPlan(data, candidates);
}
