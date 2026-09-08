from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    role: UserRole = UserRole.citizen


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    is_active: bool
    is_verified: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
