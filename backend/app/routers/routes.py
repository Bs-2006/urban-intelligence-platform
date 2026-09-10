from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_db, get_current_website_user
from app.models.route import Route
from app.schemas.route import RouteCreate, RouteUpdate, RouteOut

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.post("/", response_model=RouteOut, status_code=201)
async def add_route(data: RouteCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    route = Route(**data.model_dump())
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return route


@router.get("/", response_model=list[RouteOut])
async def get_routes(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)):
    result = await db.execute(select(Route).offset(skip).limit(limit))
    return result.scalars().all()


@router.patch("/{route_id}", response_model=RouteOut)
async def update_route(
    route_id: int, data: RouteUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_website_user)
):
    result = await db.execute(select(Route).where(Route.id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(route, field, value)
    await db.commit()
    await db.refresh(route)
    return route
