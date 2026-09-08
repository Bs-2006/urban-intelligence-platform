from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.schemas.auth import Token, VerifyEmailRequest, ResendOtpRequest
from app.schemas.user import UserCreate, UserOut
from app.services.auth_service import register_user, authenticate_user, verify_email, resend_otp

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=201, summary="Register - sends 6-digit OTP via SMTP")
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    return await register_user(db, data)


@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    return await authenticate_user(db, form.username, form.password)


@router.post("/verify-email", summary="Verify email with OTP (5 min expiry)")
async def verify_email_endpoint(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    return await verify_email(db, str(data.email), data.otp)


@router.post("/resend-otp", summary="Resend OTP with 60s cooldown")
async def resend_otp_endpoint(data: ResendOtpRequest, db: AsyncSession = Depends(get_db)):
    return await resend_otp(db, str(data.email))
