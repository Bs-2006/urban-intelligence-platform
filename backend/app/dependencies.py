from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Auto-error=False variant: returns None for anonymous callers (used where public access is allowed)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


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


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme_optional),
) -> dict | None:
    """Like get_current_user but anonymous callers get None instead of 401."""
    if not token:
        return None
    return decode_token(token)


class RoleRequirement:
    """Enforce that the signed-in user has one of the required roles."""

    def __init__(self, *roles: str):
        self.roles = roles

    async def __call__(self, current_user=Depends(get_current_user)):
        if current_user.get("role") not in self.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
