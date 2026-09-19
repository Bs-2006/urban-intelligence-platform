export type WorkStatus = "assigned"|"in_progress"|"completed"|"cancelled";
export interface WorkOrder {
  id: number; title: string; description?: string; incident_id: number;
  assigned_to: number; assigned_by?: number; status: WorkStatus;
  due_date?: string; created_at: string; updated_at?: string;
}
export interface WorkCreate { title: string; incident_id: number; assigned_to: number; description?: string; due_date?: string; }
export interface WorkEvidence {
  id: number; work_order_id: number; uploaded_by: number;
  image_url?: string; original_filename?: string; content_type?: string;
  image_size?: number; created_at?: string;
}
