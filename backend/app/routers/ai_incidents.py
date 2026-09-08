"""
AI incident ingestion endpoint.
Receives payload from pothole-ai incident_client.build_incident_payload
and creates Incident with source=ai using existing create_ai_incident().
No JWT required – machine-to-backend (document production should use service key).
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.schemas.incident import IncidentOut, IncidentCreate
from app.services.incident_service import create_ai_incident
from app.models.incident import IncidentType, IncidentSeverity, IncidentStatus
from app.services.supabase_storage import upload_incident_image, get_public_url

router = APIRouter(prefix="/api/ai", tags=["AI"])

# Road-condition scope: only pothole / damaged_road / waterlogging via simulator
ALLOWED_ROAD_TYPES = {"potholes", "pothole", "road_damage", "waterlogging"}
TYPE_MAP = {
    "potholes": "pothole",
    "pothole": "pothole",
    "road_damage": "damaged_road",
    "waterlogging": "waterlogging",
}

@router.post("/incidents", response_model=IncidentOut, status_code=201)
async def ai_create_incident(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    # payload is from build_incident_payload
    raw_type = payload.get("incident_type", "potholes")
    # Final safety filter: reject non-road-condition types from simulator flow
    if raw_type not in ALLOWED_ROAD_TYPES:
        raise HTTPException(status_code=400, detail=f"Incident type '{raw_type}' not allowed in road-condition scope (only pothole/damaged_road/waterlogging)")
    mapped = TYPE_MAP.get(raw_type, "other")
    try:
        itype = IncidentType(mapped)
    except:
        itype = IncidentType.other

    # severity/status mapping
    raw_severity = payload.get("severity", "medium")
    try:
        sev = IncidentSeverity(raw_severity)
    except:
        sev = IncidentSeverity.medium

    # Download annotated image if available and re-upload to Supabase
    image_key = None
    ai_conf = None
    meta = payload.get("metadata_json") or {}
    ai_conf = meta.get("confidence")

    # Create IncidentCreate
    data = IncidentCreate(
        incident_type=itype,
        title=payload.get("title") or f"{raw_type} detected",
        description=payload.get("description"),
        latitude=float(payload.get("latitude")) if payload.get("latitude") is not None else 16.5449,
        longitude=float(payload.get("longitude")) if payload.get("longitude") is not None else 81.5212,
        location_name=payload.get("location_name"),
        address=payload.get("address"),
        severity=sev,
        status=IncidentStatus.reported,
        bus_id=None,  # bus_id is string like BVR-101 but DB expects int FK – store in metadata
        route_id=None,
        ai_confidence=float(ai_conf) if ai_conf is not None else None,
        metadata_json={
            **meta,
            "ai_bus_id": payload.get("bus_id"),
            "ai_route_id": payload.get("route_id"),
            "ai_created_by": payload.get("created_by"),
            "ai_source": payload.get("source"),
            "raw_incident_type": raw_type,
        },
        occurred_at=None,
    )
    # Handle bus/route string – try parse int suffix
    bus_str = payload.get("bus_id")
    if bus_str:
        data.metadata_json["bus_id_str"] = bus_str
    route_str = payload.get("route_id")
    if route_str:
        data.metadata_json["route_id_str"] = route_str

    incident = await create_ai_incident(db, data)

    # Try to fetch annotated image and upload (non-blocking best effort)
    ann_path = meta.get("annotated_image_path")
    ann_url = meta.get("annotated_image_url")
    # If annotated file path is accessible, we can't access AI host file – skip unless URL fetch
    # Instead AI worker should have already persisted annotated image locally; we just keep URL in metadata
    # Optionally try to use annotated_image_url as image_key placeholder
    if ann_url:
        incident.metadata_json = {**(incident.metadata_json or {}), "annotated_image_url": ann_url}

    await db.commit()
    await db.refresh(incident)
    return incident

@router.post("/observation-status", status_code=201)
async def ai_observation_status(request: Request):
    payload = await request.json()
    # Just acknowledge – full road-status table is in AI service
    return {"ok": True, "received": payload.get("observation_id") or payload.get("status")}
