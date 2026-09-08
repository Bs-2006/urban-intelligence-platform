from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.incident import Incident
from app.schemas.incident import IncidentCreate, IncidentUpdate


async def create_incident(db: AsyncSession, data: IncidentCreate, created_by: int | None = None) -> Incident:
    payload = data.model_dump(exclude_none=True)
    # Enforce unified source lifecycle:
    # - Citizen: source=citizen, reported_by=current_user, created_by=mirrored
    # - AI: source=ai, reported_by=NULL, created_by=NULL
    # If caller explicitly passes source=ai (AI detection code), honor it and clear reported_by
    requested_source = payload.pop("source", None)
    # Default: citizen if created_by present, else ai
    from app.models.incident import IncidentSource

    if requested_source == IncidentSource.ai or (requested_source is None and created_by is None):
        source = IncidentSource.ai
        reported_by = None
        created_by_val = None
    else:
        source = IncidentSource.citizen
        reported_by = created_by
        created_by_val = created_by

    # Ensure payload does not contain reported_by from client (server-controlled)
    payload.pop("reported_by", None)
    payload["source"] = source
    payload["reported_by"] = reported_by
    payload["created_by"] = created_by_val

    incident = Incident(**payload)
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


async def create_ai_incident(db: AsyncSession, data: IncidentCreate) -> Incident:
    """Helper for AI detection code: always source=ai, reported_by=NULL"""
    return await create_incident(db, data, created_by=None)


async def list_incidents(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    incident_type: str | None = None,
    category: str | None = None,
    status: str | None = None,
    severity: str | None = None,
    bus_id: int | None = None,
    source: str | None = None,
    reported_by: int | None = None,
) -> list[Incident]:
    query = select(Incident).order_by(Incident.occurred_at.desc())
    if incident_type:
        query = query.where(Incident.incident_type == incident_type)
    if category:
        query = query.where(Incident.category == category)
    if status:
        query = query.where(Incident.status == status)
    if severity:
        query = query.where(Incident.severity == severity)
    if bus_id:
        query = query.where(Incident.bus_id == bus_id)
    if source:
        query = query.where(Incident.source == source)
    if reported_by is not None:
        query = query.where(Incident.reported_by == reported_by)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_incident(db: AsyncSession, incident_id: int) -> Incident:
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


async def update_incident(db: AsyncSession, incident_id: int, data: IncidentUpdate) -> Incident:
    incident = await get_incident(db, incident_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(incident, field, value)
    await db.commit()
    await db.refresh(incident)
    return incident


async def delete_incident(db: AsyncSession, incident_id: int) -> None:
    incident = await get_incident(db, incident_id)
    await db.delete(incident)
    await db.commit()
