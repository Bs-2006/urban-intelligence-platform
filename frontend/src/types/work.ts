export type WorkStatus = "assigned"|"in_progress"|"completed"|"cancelled";
export interface WorkOrder {
  id: number; title: string; description?: string; incident_id: number;
  assigned_to: number; assigned_by?: number; status: WorkStatus;
  due_date?: string; created_at: string; updated_at?: string;
}
export interface WorkCreate { title: string; incident_id: number; assigned_to: number; description?: string; due_date?: string; }
