export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const INCIDENT_TYPES = ["pothole","waterlogging","damaged_road","missing_divider","missing_zebra","damaged_sign","traffic_congestion","pedestrian_crossing","unsafe_driving","hit_and_run","garbage","streetlight","other"] as const;
export const INCIDENT_STATUSES = ["reported","pending","in_progress","resolved","rejected","closed"] as const;
export const SEVERITIES = ["low","medium","high","critical"] as const;
export const SOURCES = ["citizen","ai"] as const;
