import type { WorkCategory } from "./workUtils";

export interface StaffItemLog {
  id: string;
  worked_at: string;
  quantity: number | null;
  quantity_unit: string | null;
  note: string | null;
  points: number;
  photo_count: number;
}

export interface StaffWorkItem {
  id: string;
  name: string;
  description: string | null;
  category: WorkCategory;
  frequency_days: number | null;
  quantity_label: string | null;
  quantity_unit: string | null;
  photo_required: boolean;
  points: number;
  repeatable: boolean;
  /** 自分の今日の記録件数（タスク完了は含まない） */
  my_today_count: number;
  /** 自分の今日の最新の記録 */
  my_today_log: StaffItemLog | null;
  last_worked_at: string | null;
  last_staff_name: string | null;
}

export interface StaffWorkTask {
  id: string;
  item_id: string | null;
  title: string;
  description: string | null;
  category: WorkCategory;
  due_date: string | null;
  points: number;
  assignee_id: string | null;
  assignee_name: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface StaffWorkArea {
  id: string;
  name: string;
  items: StaffWorkItem[];
  tasks: StaffWorkTask[];
}

export interface StaffWorkLog {
  id: string;
  area_name: string;
  title: string;
  worked_at: string;
  quantity: number | null;
  quantity_unit: string | null;
  note: string | null;
  points: number;
  photo_count: number;
}

export interface StaffWorkScore {
  month_points: number | null;
  today_points: number;
  work_hours: number | null;
  target_points: number | null;
  bonus_yen: number | null;
  yen_per_point: number;
  monthly_bonus_cap: number;
  streak_days: number;
}

export interface StaffWorkResponse {
  staff: { id: string; name: string | null };
  areas: StaffWorkArea[];
  my_logs_today: StaffWorkLog[];
  score: StaffWorkScore;
}

/** 記録ダイアログの対象。項目の実施 / タスクの完了 */
export type RecordTarget =
  | { kind: "item"; areaId: string; item: StaffWorkItem }
  | { kind: "task"; areaId: string; task: StaffWorkTask; item: StaffWorkItem | null };
