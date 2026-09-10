from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Website roles - only admin/worker (and transport_officer as admin variant) can access dashboard APIs
# Citizens are NOT website users and must never get JWT for website
ALLOWED_WEBSITE_ROLES = {"admin", "worker", "transport_officer"}


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    return payload


async def get_current_website_user(
    payload: dict = Depends(get_current_user),
):
    """
    Enforce website access control: only admin/worker (transport_officer) allowed.
    Citizens and any other role are blocked with 403.
    Backend enforces authorization, not just frontend.
    """
    role = payload.get("role")
    if role == "citizen" or role not in ALLOWED_WEBSITE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Citizens cannot access admin/worker dashboard APIs.",
        )
    return payload


async def get_current_admin(
    payload: dict = Depends(get_current_website_user),
):
    role = payload.get("role")
    if role not in {"admin", "transport_officer"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return payload


def require_roles(*allowed: str):
    """Factory for role-specific dependencies."""
    allowed_set = set(allowed)

    async def _checker(payload: dict = Depends(get_current_website_user)):
        role = payload.get("role")
        if role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role '{role}'. Required: {', '.join(allowed_set)}",
            )
        return payload

    return _checker
