from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db, get_current_website_user
from app.schemas.bus_stand import BusStandCreate, BusStandUpdate, BusStandOut
from app.services.bus_stand_service import create_stand, list_stands, update_stand

router = APIRouter(prefix="/bus-stands", tags=["Bus Stands"])


@router.post("/", response_model=BusStandOut, status_code=201)
async def add_stand(data: BusStandCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    return await create_stand(db, data)


@router.get("/", response_model=list[BusStandOut])
async def get_stands(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    return await list_stands(db, skip, limit)


@router.patch("/{stand_id}", response_model=BusStandOut)
async def patch_stand(
    stand_id: int, data: BusStandUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)
):
    return await update_stand(db, stand_id, data)
