from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.dependencies import get_db
from app.schemas.incident import IncidentCreate, IncidentOut
from app.models.incident import Incident, IncidentSource, IncidentType, IncidentSeverity, IncidentStatus
from app.services.supabase_storage import upload_incident_image
from app.services.incident_service import get_incident

router = APIRouter(prefix="/public", tags=["Public"])

@router.post("/incidents", response_model=IncidentOut, status_code=201, summary="Anonymous citizen report - JSON or multipart with image")
async def public_create_incident(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    content_type = request.headers.get("content-type", "")
    # Multipart path: citizen with image in single request
    if "multipart/form-data" in content_type:
        form = await request.form()
        file: Optional[UploadFile] = form.get("file") or form.get("image")  # type: ignore
        def get(k, default=None):
            v = form.get(k)
            return v if v not in (None, "") else default
        try:
            incident_type = IncidentType(get("incident_type", "other"))
        except:
            incident_type = IncidentType.other
        try:
            severity = IncidentSeverity(get("severity", "medium"))
        except:
            severity = IncidentSeverity.medium
        title = get("title")
        if not title:
            raise HTTPException(status_code=422, detail="title is required")
        try:
            latitude = float(get("latitude"))
            longitude = float(get("longitude"))
        except:
            raise HTTPException(status_code=422, detail="latitude/longitude required and must be numbers")
        data = IncidentCreate(
            incident_type=incident_type,
            title=title,
            description=get("description"),
            latitude=latitude,
            longitude=longitude,
            location_name=get("location_name"),
            address=get("address"),
            severity=severity,
            status=IncidentStatus.reported,
        )
        payload = data.model_dump(exclude_none=True)
        payload.pop("source", None)
        payload.pop("reported_by", None)
        payload["source"] = IncidentSource.citizen
        payload["reported_by"] = None
        payload["created_by"] = None
        incident = Incident(**payload)
        incident.source = IncidentSource.citizen
        db.add(incident)
        await db.commit()
        await db.refresh(incident)
        # handle image if provided
        if file and getattr(file, "filename", None):
            try:
                content = await file.read()  # type: ignore
                if content:
                    image_key = await upload_incident_image(content, file.filename, incident.id, file.content_type or "image/jpeg")  # type: ignore
                    incident.image_key = image_key
                    await db.commit()
                    await db.refresh(incident)
            except HTTPException:
                raise
            except Exception as e:
                # keep incident even if image fails
                print(f"[public] image upload failed: {e}")
        return incident
    else:
        # JSON path – legacy
        try:
            body = await request.json()
        except:
            raise HTTPException(status_code=400, detail="Invalid JSON or form")
        try:
            data = IncidentCreate(**body)
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))
        payload = data.model_dump(exclude_none=True)
        payload.pop("source", None)
        payload.pop("reported_by", None)
        payload["source"] = IncidentSource.citizen
        payload["reported_by"] = None
        payload["created_by"] = None
        incident = Incident(**payload)
        incident.source = IncidentSource.citizen
        db.add(incident)
        await db.commit()
        await db.refresh(incident)
        return incident


@router.get("/incidents/{incident_id}", response_model=IncidentOut, summary="Track citizen complaint by ID - no auth required")
async def public_track_incident(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for citizens to track their complaint status.
    No authentication required - anyone with the complaint ID can view it.
    """
    return await get_incident(db, incident_id)
