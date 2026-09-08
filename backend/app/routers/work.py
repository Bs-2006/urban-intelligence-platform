from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_user
from app.schemas.work import WorkOrderCreate, WorkOrderUpdate, WorkOrderOut
from app.services.work_service import create_work_order, list_work_orders, update_work_order

router = APIRouter(prefix="/work", tags=["Work Orders"])


@router.post("/", response_model=WorkOrderOut, status_code=201)
async def create_order(
    data: WorkOrderCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await create_work_order(db, data, created_by=int(current_user["sub"]))


@router.get("/", response_model=list[WorkOrderOut])
async def get_orders(
    skip: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    return await list_work_orders(db, skip, limit)


@router.get("/stats", summary="Work stats aggregated by status (for agent)")
async def get_work_stats(status: str | None = None, assigned_to: int | None = None, incident_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import select
    from app.models.work import WorkOrder
    from collections import Counter
    q = select(WorkOrder)
    if status: q = q.where(WorkOrder.status == status)
    if assigned_to is not None: q = q.where(WorkOrder.assigned_to == assigned_to)
    if incident_id is not None: q = q.where(WorkOrder.incident_id == incident_id)
    rows = (await db.execute(q)).scalars().all()
    total = len(rows)
    by_status = dict(Counter(getattr(r.status, "value", str(r.status)) for r in rows))
    return {"total": total, "by_status": by_status}

@router.patch("/{order_id}", response_model=WorkOrderOut)
async def patch_order(
    order_id: int,
    data: WorkOrderUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    return await update_work_order(db, order_id, data)

