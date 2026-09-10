import secrets
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.user import UserCreate
from app.schemas.auth import Token
from app.utils.security import hash_password, verify_password, create_access_token
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _generate_otp() -> str:
    # secure 6-digit OTP, zero-padded
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _verify_otp_hash(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(_hash_otp(otp), otp_hash)


async def _send_otp_email(email: str, otp: str) -> None:
    try:
        from app.utils.email import send_otp_email

        await send_otp_email(email, otp)
        logger.info("OTP email dispatched to %s", email)
    except Exception as e:
        # Log with full stacktrace so failures are visible; do not break registration
        # (OTP is still saved and can be resent). In production you may want to raise.
        logger.exception("Failed to send OTP email to %s: %s", email, e)


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    # Only admin/worker can register - reject citizen (public citizens do NOT create accounts)
    # Keep citizen frontend separate: citizens submit complaints via /public/* without account
    role_val = data.role.value if hasattr(data.role, "value") else str(data.role)
    if role_val == "citizen":
        raise HTTPException(status_code=400, detail="Citizen registration not allowed. Only admin and worker can register.")
    # Also reject any role not in allowed website roles
    allowed_roles = {"admin", "worker", "transport_officer"}
    if role_val not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role '{role_val}'. Only admin and worker can register.")
    # Check duplicate email (including unverified accounts) - do not create another account
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    # Check duplicate phone cleanly with 400 instead of DB 500
    if data.phone:
        existing_phone = await db.execute(select(User).where(User.phone == data.phone))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone already registered")
    otp = _generate_otp()
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=settings.otp_expire_minutes)
    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_verified=False,
        otp_hash=_hash_otp(otp),
        otp_expires_at=expires,
        otp_sent_at=now,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        # Handle race condition or unique constraint on email/phone with 400
        raise HTTPException(status_code=400, detail="Email or phone already registered")
    await db.refresh(user)
    await _send_otp_email(user.email, otp)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> Token:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    # Citizens are NOT website users - reject citizen login even if account exists
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_val == "citizen":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizen login not allowed. Citizens do not have website accounts.")
    # Only admin/worker (and transport_officer) can log in to website
    allowed_roles = {"admin", "worker", "transport_officer"}
    if role_val not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Login not allowed for this role.")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email with OTP.",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
    token = create_access_token({"sub": str(user.id), "role": role_val})
    return Token(access_token=token)


async def verify_email(db: AsyncSession, email: str, otp: str) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        return {"detail": "Email already verified"}
    if not user.otp_hash or not user.otp_expires_at:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new one.")
    now = datetime.now(timezone.utc)
    if user.otp_expires_at < now:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    if not _verify_otp_hash(otp, user.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid OTP")
    user.is_verified = True
    user.otp_hash = None
    user.otp_expires_at = None
    user.otp_sent_at = None
    await db.commit()
    await db.refresh(user)
    return {"detail": "Email verified successfully"}


async def resend_otp(db: AsyncSession, email: str) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    now = datetime.now(timezone.utc)
    if user.otp_sent_at:
        # ensure aware datetime for comparison
        sent = user.otp_sent_at
        if sent.tzinfo is None:
            sent = sent.replace(tzinfo=timezone.utc)
        elapsed = (now - sent).total_seconds()
        if elapsed < settings.otp_resend_cooldown_seconds:
            retry_after = int(settings.otp_resend_cooldown_seconds - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {retry_after}s before requesting a new OTP",
            )
    otp = _generate_otp()
    user.otp_hash = _hash_otp(otp)
    user.otp_expires_at = now + timedelta(minutes=settings.otp_expire_minutes)
    user.otp_sent_at = now
    await db.commit()
    await db.refresh(user)
    await _send_otp_email(user.email, otp)
    return {"detail": "OTP resent successfully"}
