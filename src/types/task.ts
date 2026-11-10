export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  /** 詳細・メモ */
  note: string;
  /** 期限。'YYYY-MM-DD' 形式（端末のローカル日付）。未設定は null */
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  /** 完了にした日時（ISO 8601）。未完了は null */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 登録・編集フォームで入力する項目 */
export type TaskInput = Pick<Task, 'title' | 'note' | 'dueDate' | 'priority'>;

export type TaskFilter = 'all' | 'active' | 'completed';

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const PRIORITY_ORDER: readonly Priority[] = ['high', 'medium', 'low'];
