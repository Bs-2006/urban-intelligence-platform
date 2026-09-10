from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_db, get_current_website_user
from app.models.bus import Bus
from app.schemas.bus import BusCreate, BusUpdate, BusOut

router = APIRouter(prefix="/buses", tags=["Buses"])


@router.post("/", response_model=BusOut, status_code=201)
async def add_bus(data: BusCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    bus = Bus(**data.model_dump())
    db.add(bus)
    await db.commit()
    await db.refresh(bus)
    return bus


@router.get("/", response_model=list[BusOut])
async def get_buses(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    result = await db.execute(select(Bus).offset(skip).limit(limit))
    return result.scalars().all()


@router.patch("/{bus_id}", response_model=BusOut)
async def update_bus(
    bus_id: int, data: BusUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)
):
    result = await db.execute(select(Bus).where(Bus.id == bus_id))
    bus = result.scalar_one_or_none()
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(bus, field, value)
    await db.commit()
    await db.refresh(bus)
    return bus
