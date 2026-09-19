from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user, RoleRequirement
from app.schemas.work import WorkOrderCreate, WorkOrderUpdate, WorkOrderOut
from app.schemas.work_evidence import WorkEvidenceOut
from app.services.work_service import (
    create_work_order,
    list_work_orders,
    update_work_order,
    get_work_order,
    list_work_evidence,
    upload_work_evidence,
)

router = APIRouter(prefix="/work", tags=["Work Orders"])


@router.post("/", response_model=WorkOrderOut, status_code=201, summary="Create work order (admin only)")
async def create_order(
    data: WorkOrderCreate,
    current_user=Depends(RoleRequirement("admin")),
    db: AsyncSession = Depends(get_db),
):
    return await create_work_order(db, data, created_by=int(current_user["sub"]))


@router.get("/", response_model=list[WorkOrderOut], summary="List work orders (workers only see their own)")
async def get_orders(
    skip: int = 0,
    limit: int = 20,
    assigned_to: int | None = Query(None, description="Filter by assignee (admins only)"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Workers must never see other workers' work orders; force their own scope.
    if current_user.get("role") == "worker":
        assigned_to = int(current_user["sub"])
    return await list_work_orders(db, skip, limit, assigned_to)


@router.get("/stats", summary="Work stats aggregated by status (worker scope enforced)")
async def get_work_stats(
    status: str | None = None,
    assigned_to: int | None = Query(None, description="Filter by assignee (admins can override; workers ignored)"),
    incident_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from sqlalchemy import select
    from app.models.work import WorkOrder
    from collections import Counter
    if current_user.get("role") == "worker":
        assigned_to = int(current_user["sub"])
    q = select(WorkOrder)
    if status:
        q = q.where(WorkOrder.status == status)
    if assigned_to is not None:
        q = q.where(WorkOrder.assigned_to == assigned_to)
    if incident_id is not None:
        q = q.where(WorkOrder.incident_id == incident_id)
    rows = (await db.execute(q)).scalars().all()
    total = len(rows)
    by_status = dict(Counter(getattr(r.status, "value", str(r.status)) for r in rows))
    return {"total": total, "by_status": by_status}


@router.get("/{order_id}", response_model=WorkOrderOut, summary="Get one work order (workers only their own)")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await get_work_order(db, order_id, current_user)


@router.get("/{order_id}/evidence", response_model=list[WorkEvidenceOut], summary="List after-image evidence (assigned worker or admin)")
async def get_evidence(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await list_work_evidence(db, order_id, current_user)


@router.post("/{order_id}/evidence", response_model=WorkEvidenceOut, status_code=201, summary="Upload after-image proof (assigned worker or admin)")
async def post_evidence(
    order_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    file_bytes = await file.read()
    return await upload_work_evidence(db, order_id, file_bytes, file.filename or "evidence.jpg", file.content_type or "image/jpeg", current_user)


@router.patch("/{order_id}", response_model=WorkOrderOut, summary="Update work order (workers: own status only)")
async def patch_order(
    order_id: int,
    data: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await update_work_order(db, order_id, data, current_user)