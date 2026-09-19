from typing import Annotated

from fastapi import APIRouter, Body, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.schemas.auth import Token, VerifyEmailRequest, ResendOtpRequest
from app.schemas.user import (
    UserCreate,
    UserOut,
    ADMIN_REGISTRATION_EXAMPLE,
    WORKER_REGISTRATION_EXAMPLE,
    ADMIN_RESPONSE_EXAMPLE,
    WORKER_RESPONSE_EXAMPLE,
)
from app.services.auth_service import register_user, authenticate_user, verify_email, resend_otp

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=201,
    summary="Register - sends 6-digit OTP via SMTP",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/UserCreate"},
                    "examples": {
                        "Admin registration": {"value": ADMIN_REGISTRATION_EXAMPLE},
                        "Worker registration": {"value": WORKER_REGISTRATION_EXAMPLE},
                    },
                }
            },
            "required": True,
        },
        "responses": {
            "201": {
                "description": "Registered user (OTP emailed). Admin: specialization null. Worker: specialization set.",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/UserOut"},
                        "examples": {
                            "Admin response": {"value": ADMIN_RESPONSE_EXAMPLE},
                            "Worker response": {"value": WORKER_RESPONSE_EXAMPLE},
                        },
                    }
                },
            },
        },
    },
)
async def register(
    data: Annotated[
        UserCreate,
        Body(
            description="Admin: role=admin, no specialization. Worker: role=worker, exactly one specialization.",
        ),
    ],
    db: AsyncSession = Depends(get_db),
):
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
