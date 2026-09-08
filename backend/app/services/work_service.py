from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.work import WorkOrder
from app.schemas.work import WorkOrderCreate, WorkOrderUpdate


async def create_work_order(db: AsyncSession, data: WorkOrderCreate, created_by: int) -> WorkOrder:
    order = WorkOrder(**data.model_dump(), created_by=created_by)
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def list_work_orders(db: AsyncSession, skip: int = 0, limit: int = 20) -> list[WorkOrder]:
    result = await db.execute(select(WorkOrder).offset(skip).limit(limit))
    return result.scalars().all()


async def update_work_order(db: AsyncSession, order_id: int, data: WorkOrderUpdate) -> WorkOrder:
    result = await db.execute(select(WorkOrder).where(WorkOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Work order not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    await db.commit()
    await db.refresh(order)
    return order
