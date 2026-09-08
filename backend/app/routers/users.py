from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut], summary="List users (filtered by role)")
async def list_users(
    role: str | None = Query(None, description="Filter by role: citizen|admin|worker|transport_officer"),
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(User)
    if role:
        q = q.where(User.role == role)
    q = q.offset(skip).limit(limit).order_by(User.id)
    result = await db.execute(q)
    return list(result.scalars().all())


@router.get("/stats", summary="User stats aggregated by role (for agent)")
async def get_users_stats(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    from sqlalchemy import select
    from app.models.user import User
    from collections import Counter
    rows = (await db.execute(select(User))).scalars().all()
    total = len(rows)
    by_role = dict(Counter(getattr(r.role, "value", str(r.role)) for r in rows))
    return {"total": total, "by_role": by_role}

@router.get("/me", response_model=UserOut)
async def get_me(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
    return result.scalar_one()


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == int(current_user["sub"])))
    user = result.scalar_one()
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user

