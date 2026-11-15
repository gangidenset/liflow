import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { loadTasks, saveTasks } from '@/storage/taskStorage';
import { mergeById, withoutDeleted } from '@/sync/merge';
import type { Task, TaskInput } from '@/types/task';

export type TaskAction =
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'added'; task: Task }
  | { type: 'updated'; id: string; input: TaskInput; now: string }
  | { type: 'toggled'; id: string; now: string }
  | { type: 'deleted'; id: string; now: string }
  /** 同期で受け取った記録を取り込む（新しい方を残す） */
  | { type: 'merged'; tasks: Task[] }
  /** すべて消す（ログアウト時） */
  | { type: 'reset' };

export function taskReducer(state: Task[], action: TaskAction): Task[] {
  switch (action.type) {
    case 'loaded':
      return action.tasks;
    case 'added':
      return [action.task, ...state];
    case 'updated':
      return state.map((task) =>
        task.id === action.id ? { ...task, ...action.input, updatedAt: action.now } : task,
      );
    case 'toggled':
      return state.map((task) =>
        task.id === action.id
          ? {
              ...task,
              completed: !task.completed,
              completedAt: task.completed ? null : action.now,
              updatedAt: action.now,
            }
          : task,
      );
    case 'deleted':
      // 記録は残して削除日時を付ける（同期で他の端末に削除を伝えるため）
      return state.map((task) =>
        task.id === action.id ? { ...task, deletedAt: action.now, updatedAt: action.now } : task,
      );
    case 'merged':
      return mergeById(state, action.tasks);
    case 'reset':
      return [];
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(input: TaskInput): TaskInput {
  return { ...input, title: input.title.trim(), note: input.note.trim() };
}

type TaskContextValue = {
  /** 画面に出すタスク（削除済みを除く） */
  tasks: Task[];
  /** 削除済みも含むすべてのタスク（同期用） */
  allTasks: Task[];
  /** 保存済みデータの読み込みが終わったか */
  isLoaded: boolean;
  /** 読み込み・保存に失敗したときのメッセージ */
  storageError: string | null;
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  /** 同期で受け取ったタスクを取り込む */
  mergeTasks: (tasks: Task[]) => void;
  /** 端末内のタスクをすべて消す */
  resetTasks: () => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [allTasks, dispatch] = useReducer(taskReducer, []);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  /** 読み込みに失敗した場合、既存の保存データを空の一覧で上書きしないために保存を止める */
  const canSave = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadTasks()
      .then((loaded) => {
        if (cancelled) return;
        dispatch({ type: 'loaded', tasks: loaded });
        canSave.current = true;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn('Failed to load tasks', error);
        setStorageError('保存データを読み込めませんでした。アプリを再起動してください。');
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !canSave.current) return;
    saveTasks(allTasks)
      .then(() => setStorageError(null))
      .catch((error: unknown) => {
        console.warn('Failed to save tasks', error);
        setStorageError('タスクを保存できませんでした。端末の空き容量を確認してください。');
      });
  }, [allTasks, isLoaded]);

  const addTask = useCallback((input: TaskInput) => {
    const now = new Date().toISOString();
    dispatch({
      type: 'added',
      task: {
        id: createId(),
        ...normalize(input),
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    });
  }, []);

  const updateTask = useCallback((id: string, input: TaskInput) => {
    dispatch({ type: 'updated', id, input: normalize(input), now: new Date().toISOString() });
  }, []);

  const toggleTask = useCallback((id: string) => {
    dispatch({ type: 'toggled', id, now: new Date().toISOString() });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'deleted', id, now: new Date().toISOString() });
  }, []);

  const mergeTasks = useCallback((tasks: Task[]) => {
    dispatch({ type: 'merged', tasks });
  }, []);

  const resetTasks = useCallback(() => {
    // 読み込みに失敗していた場合も、明示的に消すときは保存を再開する
    canSave.current = true;
    setStorageError(null);
    dispatch({ type: 'reset' });
  }, []);

  const tasks = useMemo(() => withoutDeleted(allTasks), [allTasks]);

  const value = useMemo(
    () => ({
      tasks,
      allTasks,
      isLoaded,
      storageError,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      mergeTasks,
      resetTasks,
    }),
    [
      tasks,
      allTasks,
      isLoaded,
      storageError,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      mergeTasks,
      resetTasks,
    ],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const value = useContext(TaskContext);
  if (!value) throw new Error('useTasks は TaskProvider の内側で使用してください');
  return value;
}
