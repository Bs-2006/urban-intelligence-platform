export type IncidentType = "pothole"|"waterlogging"|"damaged_road"|"missing_divider"|"missing_zebra"|"damaged_sign"|"traffic_congestion"|"pedestrian_crossing"|"unsafe_driving"|"hit_and_run"|"garbage"|"streetlight"|"other";
export type IncidentStatus = "reported"|"pending"|"in_progress"|"resolved"|"rejected"|"closed";
export type IncidentSeverity = "low"|"medium"|"high"|"critical";
export type IncidentSource = "citizen"|"ai";
export interface Incident {
  id: number;
  title: string;
  description?: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  severity: IncidentSeverity;
  source: IncidentSource;
  category?: string;
  location_name?: string;
  address?: string;
  latitude: number;
  longitude: number;
  bus_id?: number;
  route_id?: number;
  reported_by?: number;
  ai_confidence?: number;
  image_url?: string;
  district?: string;
  ward?: string;
  created_at: string;
  occurred_at?: string;
  updated_at?: string;
}
export interface IncidentCreate {
  title: string; description?: string; incident_type: IncidentType; severity: IncidentSeverity;
  location_name?: string; address?: string; latitude: number; longitude: number;
  bus_id?: number; route_id?: number; category?: string;
}
