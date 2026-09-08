from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.models.bus_stand import BusStand
from app.schemas.bus_stand import BusStandCreate, BusStandUpdate


async def create_stand(db: AsyncSession, data: BusStandCreate) -> BusStand:
    stand = BusStand(**data.model_dump())
    db.add(stand)
    await db.commit()
    await db.refresh(stand)
    return stand


async def list_stands(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[BusStand]:
    result = await db.execute(select(BusStand).offset(skip).limit(limit))
    return result.scalars().all()


async def update_stand(db: AsyncSession, stand_id: int, data: BusStandUpdate) -> BusStand:
    result = await db.execute(select(BusStand).where(BusStand.id == stand_id))
    stand = result.scalar_one_or_none()
    if not stand:
        raise HTTPException(status_code=404, detail="Bus stand not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(stand, field, value)
    await db.commit()
    await db.refresh(stand)
    return stand
