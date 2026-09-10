from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user, get_current_website_user
from app.schemas.incident import IncidentCreate, IncidentUpdate, IncidentOut
from app.services.incident_service import (
    create_incident,
    list_incidents,
    get_incident,
    update_incident,
    delete_incident,
)
from app.services.supabase_storage import upload_incident_image

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.post("/", response_model=IncidentOut, status_code=201, summary="Create citizen incident (source=citizen, reported_by=current user) - JWT required")
async def add_incident(
    data: IncidentCreate,
    current_user=Depends(get_current_website_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce citizen source; AI should use internal create_ai_incident
    data.source = None  # force citizen path via service (created_by != None -> citizen)
    return await create_incident(db, data, created_by=int(current_user["sub"]))


@router.get("/", response_model=list[IncidentOut])
async def get_incidents(
    skip: int = 0,
    limit: int = 50,
    incident_type: str | None = Query(
        None,
        description="Filter by incident_type: pothole | waterlogging | damaged_road | missing_divider | missing_zebra | damaged_sign | traffic_congestion | pedestrian_crossing | unsafe_driving | hit_and_run | garbage | streetlight | other",
    ),
    category: str | None = Query(None, description="Filter by category/subtype"),
    status: str | None = Query(None, description="Filter by status: pending | in_progress | resolved | reported | rejected | closed"),
    severity: str | None = None,
    bus_id: int | None = None,
    source: str | None = Query(None, description="Filter by source: citizen | ai"),
    reported_by: int | None = Query(None, description="Filter by reported_by user id"),
    db: AsyncSession = Depends(get_db),
):
    return await list_incidents(db, skip, limit, incident_type, category, status, severity, bus_id, source, reported_by)


@router.get("/stats/summary", summary="Incident stats aggregated by status/source/type/severity (for agent) - JWT required")
async def get_incident_stats(incident_type: str | None = None, status: str | None = None, severity: str | None = None, source: str | None = None, bus_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    from sqlalchemy import select, func
    from app.models.incident import Incident
    q = select(Incident)
    if incident_type: q = q.where(Incident.incident_type == incident_type)
    if status: q = q.where(Incident.status == status)
    if severity: q = q.where(Incident.severity == severity)
    if source: q = q.where(Incident.source == source)
    if bus_id is not None: q = q.where(Incident.bus_id == bus_id)
    rows = (await db.execute(q)).scalars().all()
    total = len(rows)
    from collections import Counter
    by_status = dict(Counter(getattr(r.status, "value", str(r.status)) for r in rows))
    by_source = dict(Counter(getattr(r.source, "value", str(r.source)) for r in rows))
    by_type = dict(Counter(getattr(r.incident_type, "value", str(r.incident_type)) for r in rows))
    by_severity = dict(Counter(getattr(r.severity, "value", str(r.severity)) for r in rows))
    return {"total": total, "by_status": by_status, "by_source": by_source, "by_type": by_type, "by_severity": by_severity}

@router.get("/stats", include_in_schema=False)
async def get_incident_stats_alias(incident_type: str | None = None, status: str | None = None, severity: str | None = None, source: str | None = None, bus_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    from sqlalchemy import select
    from app.models.incident import Incident
    from collections import Counter
    q = select(Incident)
    if incident_type: q = q.where(Incident.incident_type == incident_type)
    if status: q = q.where(Incident.status == status)
    if severity: q = q.where(Incident.severity == severity)
    if source: q = q.where(Incident.source == source)
    if bus_id is not None: q = q.where(Incident.bus_id == bus_id)
    rows = (await db.execute(q)).scalars().all()
    total = len(rows)
    by_status = dict(Counter(getattr(r.status, "value", str(r.status)) for r in rows))
    by_source = dict(Counter(getattr(r.source, "value", str(r.source)) for r in rows))
    by_type = dict(Counter(getattr(r.incident_type, "value", str(r.incident_type)) for r in rows))
    by_severity = dict(Counter(getattr(r.severity, "value", str(r.severity)) for r in rows))
    return {"total": total, "by_status": by_status, "by_source": by_source, "by_type": by_type, "by_severity": by_severity}

@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident_by_id(incident_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    return await get_incident(db, incident_id)


@router.patch("/{incident_id}", response_model=IncidentOut)
async def patch_incident(
    incident_id: int,
    data: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_website_user),
):
    return await update_incident(db, incident_id, data)


@router.delete("/{incident_id}", status_code=204)
async def remove_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_website_user),
):
    await delete_incident(db, incident_id)
    return None


@router.post("/{incident_id}/image", response_model=IncidentOut, summary="Upload incident image to Supabase Storage - JWT required")
async def upload_incident_image_endpoint(
    incident_id: int,
    file: UploadFile = File(..., description="Image file (jpeg/png/webp/gif, max 5MB)"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_website_user),
):
    # Minimal validation: must be image
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (jpeg/png/webp/gif)")
    incident = await get_incident(db, incident_id)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")
    # Service validates size, type and uploads to incidents/{incident_id}/{unique_filename}
    image_key = await upload_incident_image(
        file_bytes, file.filename or "image.jpg", incident_id, file.content_type
    )
    # Save only the Supabase storage path in PostgreSQL; do not store binary
    incident.image_key = image_key
    await db.commit()
    await db.refresh(incident)
    return incident

