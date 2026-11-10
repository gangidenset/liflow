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
import type { Task, TaskInput } from '@/types/task';

type Action =
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'added'; task: Task }
  | { type: 'updated'; id: string; input: TaskInput; now: string }
  | { type: 'toggled'; id: string; now: string }
  | { type: 'deleted'; id: string };

function reducer(state: Task[], action: Action): Task[] {
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
      return state.filter((task) => task.id !== action.id);
  }
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(input: TaskInput): TaskInput {
  return { ...input, title: input.title.trim(), note: input.note.trim() };
}

type TaskContextValue = {
  tasks: Task[];
  /** 保存済みデータの読み込みが終わったか */
  isLoaded: boolean;
  /** 読み込み・保存に失敗したときのメッセージ */
  storageError: string | null;
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, dispatch] = useReducer(reducer, []);
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
    saveTasks(tasks)
      .then(() => setStorageError(null))
      .catch((error: unknown) => {
        console.warn('Failed to save tasks', error);
        setStorageError('タスクを保存できませんでした。端末の空き容量を確認してください。');
      });
  }, [tasks, isLoaded]);

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
    dispatch({ type: 'deleted', id });
  }, []);

  const value = useMemo(
    () => ({ tasks, isLoaded, storageError, addTask, updateTask, toggleTask, deleteTask }),
    [tasks, isLoaded, storageError, addTask, updateTask, toggleTask, deleteTask],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks(): TaskContextValue {
  const value = useContext(TaskContext);
  if (!value) throw new Error('useTasks は TaskProvider の内側で使用してください');
  return value;
}
