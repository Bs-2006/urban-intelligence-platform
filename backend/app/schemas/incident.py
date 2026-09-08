from pydantic import BaseModel
from datetime import datetime
from typing import Any
from app.models.incident import IncidentType, IncidentSeverity, IncidentStatus, IncidentSource


class IncidentCreate(BaseModel):
    incident_type: IncidentType
    category: str | None = None
    severity: IncidentSeverity = IncidentSeverity.medium
    status: IncidentStatus = IncidentStatus.pending  # unified lifecycle: pending -> in_progress -> resolved
    title: str
    description: str | None = None
    latitude: float
    longitude: float
    location_name: str | None = None
    address: str | None = None
    bus_id: int | None = None
    route_id: int | None = None
    speed_kmh: float | None = None
    avg_speed_kmh: float | None = None
    vehicle_count: int | None = None
    congestion_level: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    occurred_at: datetime | None = None
    image_key: str | None = None  # Supabase storage key, allowed for citizen & AI
    ai_confidence: float | None = None
    metadata_json: dict[str, Any] | None = None
    # source/reported_by are set server-side: citizen -> reported_by=current_user, ai -> reported_by=NULL
    source: IncidentSource | None = None


class IncidentUpdate(BaseModel):
    incident_type: IncidentType | None = None
    category: str | None = None
    severity: IncidentSeverity | None = None
    status: IncidentStatus | None = None
    title: str | None = None
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_name: str | None = None
    address: str | None = None
    bus_id: int | None = None
    route_id: int | None = None
    speed_kmh: float | None = None
    avg_speed_kmh: float | None = None
    vehicle_count: int | None = None
    congestion_level: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    occurred_at: datetime | None = None
    image_key: str | None = None
    ai_confidence: float | None = None
    source: IncidentSource | None = None
    reported_by: int | None = None
    metadata_json: dict[str, Any] | None = None


class IncidentOut(BaseModel):
    id: int
    incident_type: IncidentType
    category: str | None
    severity: IncidentSeverity
    status: IncidentStatus
    title: str
    description: str | None
    latitude: float
    longitude: float
    location_name: str | None
    address: str | None
    bus_id: int | None
    route_id: int | None
    created_by: int | None
    reported_by: int | None = None
    source: IncidentSource
    speed_kmh: float | None
    avg_speed_kmh: float | None
    vehicle_count: int | None
    congestion_level: str | None
    start_time: datetime | None
    end_time: datetime | None
    occurred_at: datetime | None
    image_key: str | None
    image_url: str | None = None  # computed public Supabase URL
    ai_confidence: float | None = None
    metadata_json: dict[str, Any] | None
    created_at: datetime | None
    updated_at: datetime | None

    model_config = {"from_attributes": True}
