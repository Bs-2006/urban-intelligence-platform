from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
import json
from app.dependencies import get_db
from app.models.vehicle_security import VehicleSecurityEvent

router = APIRouter(prefix="/api/vehicle-security", tags=["Vehicle Security"])

@router.get("")
@router.get("/")
async def list_events(
    bus_id: Optional[str] = Query(None),
    route_id: Optional[str] = Query(None),
    stolen: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    q = select(VehicleSecurityEvent).order_by(desc(VehicleSecurityEvent.created_at))
    if bus_id:
        q = q.where(VehicleSecurityEvent.bus_id == bus_id)
    if route_id:
        q = q.where(VehicleSecurityEvent.route_id == route_id)
    if stolen is not None:
        q = q.where(VehicleSecurityEvent.stolen == stolen)
    q = q.offset(offset).limit(limit)
    res = await db.execute(q)
    rows = res.scalars().all()
    out=[]
    for r in rows:
        try:
            bbox=json.loads(r.bbox) if r.bbox else None
        except:
            bbox=None
        out.append({
            "id": r.id,
            "observation_id": r.observation_id,
            "bus_id": r.bus_id,
            "route_id": r.route_id,
            "plate_number": r.plate_number,
            "plate_normalized": r.plate_normalized,
            "detector_confidence": r.detector_confidence,
            "ocr_confidence": r.ocr_confidence,
            "stolen": r.stolen,
            "status": r.status,
            "priority": r.priority,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "location_name": r.location_name,
            "image_url": r.image_url,
            "image_path": r.image_path,
            "bbox": bbox,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return out

@router.get("/{event_id}")
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(VehicleSecurityEvent).where(VehicleSecurityEvent.id==event_id))
    r=res.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")
    try:
        bbox=json.loads(r.bbox) if r.bbox else None
    except:
        bbox=None
    return {
        "id": r.id,
        "observation_id": r.observation_id,
        "bus_id": r.bus_id,
        "route_id": r.route_id,
        "plate_number": r.plate_number,
        "plate_normalized": r.plate_normalized,
        "detector_confidence": r.detector_confidence,
        "ocr_confidence": r.ocr_confidence,
        "stolen": r.stolen,
        "status": r.status,
        "priority": r.priority,
        "latitude": r.latitude,
        "longitude": r.longitude,
        "location_name": r.location_name,
        "image_url": r.image_url,
        "image_path": r.image_path,
        "bbox": bbox,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }

# Internal ingestion endpoint called by AI worker (no auth for prototype, idempotent by observation_id)
@router.post("")
@router.post("/")
async def create_event(payload: dict, db: AsyncSession = Depends(get_db)):
    obs_id = str(payload.get("observation_id") or payload.get("id") or "")
    if not obs_id:
        raise HTTPException(400, "observation_id required")
    # idempotency
    existing = await db.execute(select(VehicleSecurityEvent).where(VehicleSecurityEvent.observation_id==obs_id))
    if existing.scalar_one_or_none():
        return {"ok": True, "skipped": True, "observation_id": obs_id}
    import json as j
    bbox_str = j.dumps(payload.get("bbox")) if payload.get("bbox") else None
    ev = VehicleSecurityEvent(
        observation_id=obs_id,
        bus_id=payload.get("bus_id"),
        route_id=payload.get("route_id"),
        plate_number=payload.get("plate_number") or payload.get("plate_text") or payload.get("ocr_text"),
        plate_normalized=payload.get("plate_normalized") or payload.get("normalized_plate"),
        detector_confidence=payload.get("detector_confidence") or payload.get("confidence"),
        ocr_confidence=payload.get("ocr_confidence"),
        stolen=bool(payload.get("stolen")),
        status=payload.get("status"),
        priority=payload.get("priority"),
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        location_name=payload.get("location_name"),
        image_url=payload.get("image_url"),
        image_path=payload.get("image_path"),
        bbox=bbox_str,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return {"ok": True, "id": ev.id, "observation_id": obs_id}
