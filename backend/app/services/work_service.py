from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.work import WorkOrder, WorkStatus
from app.models.work_evidence import WorkOrderEvidence
from app.schemas.work import WorkOrderCreate, WorkOrderUpdate


async def create_work_order(db: AsyncSession, data: WorkOrderCreate, created_by: int) -> WorkOrder:
    order = WorkOrder(**data.model_dump(), created_by=created_by)
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def list_work_orders(db: AsyncSession, skip: int = 0, limit: int = 20, assigned_to: int | None = None) -> list[WorkOrder]:
    query = select(WorkOrder)
    if assigned_to is not None:
        query = query.where(WorkOrder.assigned_to == assigned_to)
    result = await db.execute(query.offset(skip).limit(limit))
    return list(result.scalars().all())


async def get_work_order(db: AsyncSession, order_id: int, current_user: dict) -> WorkOrder:
    result = await db.execute(select(WorkOrder).where(WorkOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    # Workers may only read work orders assigned to themselves.
    if current_user.get("role") == "worker" and order.assigned_to != int(current_user["sub"]):
        raise HTTPException(status_code=404, detail="Work order not found")
    return order


async def update_work_order(db: AsyncSession, order_id: int, data: WorkOrderUpdate, current_user: dict) -> WorkOrder:
    result = await db.execute(select(WorkOrder).where(WorkOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    # Workers may only update the status of work orders assigned to themselves.
    if current_user.get("role") == "worker":
        if order.assigned_to != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="You can only update your own work orders")
        if data.status is None or data.assigned_to is not None or data.description is not None:
            raise HTTPException(
                status_code=400,
                detail="Workers can only change the status of their assigned work orders",
            )
        if data.status == WorkStatus.completed:
            evidence = await _evidence_count(db, order_id)
            if evidence == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Please upload an after-work image before marking this work as completed.",
                )
        order.status = data.status
        await db.commit()
        await db.refresh(order)
        return order
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    await db.commit()
    await db.refresh(order)
    return order


async def _evidence_count(db: AsyncSession, order_id: int) -> int:
    from sqlalchemy import func

    result = await db.execute(select(func.count(WorkOrderEvidence.id)).where(WorkOrderEvidence.work_order_id == order_id))
    return int(result.scalar() or 0)


async def list_work_evidence(db: AsyncSession, order_id: int, current_user: dict) -> list[WorkOrderEvidence]:
    """Return After-image evidence for a work order.

    Admins may read any; workers can only read evidence of their own work orders
    (get_work_order enforces the ownership 404 for workers).
    """
    await get_work_order(db, order_id, current_user)
    from sqlalchemy import desc

    result = await db.execute(
        select(WorkOrderEvidence)
        .where(WorkOrderEvidence.work_order_id == order_id)
        .order_by(desc(WorkOrderEvidence.created_at))
    )
    return list(result.scalars().all())


async def upload_work_evidence(
    db: AsyncSession,
    order_id: int,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    current_user: dict,
) -> WorkOrderEvidence:
    """Attach the After (completion-proof) image to a work order.

    Only the assigned worker may upload evidence for a work order; admins may
    upload in support. A worker cannot upload to another worker's work order
    (get_work_order 404s non-owned orders for workers).
    """
    await get_work_order(db, order_id, current_user)

    from app.services.supabase_storage import upload_work_evidence_image

    image_key = await upload_work_evidence_image(file_bytes, filename, order_id, content_type or "image/jpeg")

    user_id = int(current_user["sub"])
    meta = {"filename": filename, "uploaded_by": user_id}

    # Single proof record per work order: replace any previous entry (the UI
    # does not surface a replacement option; this just prevents unbounded rows).
    result = await db.execute(select(WorkOrderEvidence).where(WorkOrderEvidence.work_order_id == order_id))
    existing = result.scalars().all()
    for row in existing:
        await db.delete(row)

    evidence = WorkOrderEvidence(
        work_order_id=order_id,
        uploaded_by=user_id,
        image_key=image_key,
        original_filename=filename,
        content_type=content_type or "image/jpeg",
        image_size=len(file_bytes),
        metadata_json=meta,
    )
    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)
    return evidence
