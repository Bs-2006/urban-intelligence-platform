from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from datetime import datetime
from app.models.user import UserRole, WorkerSpecialization


ADMIN_REGISTRATION_EXAMPLE = {
    "full_name": "Admin User",
    "email": "admin@example.com",
    "phone": "9876543210",
    "password": "Secret@123",
    "role": "admin",
}

WORKER_REGISTRATION_EXAMPLE = {
    "full_name": "Ravi Kumar",
    "email": "ravi@example.com",
    "phone": "9876543210",
    "password": "Secret@123",
    "role": "worker",
    "specialization": "road_maintenance",
}

ADMIN_RESPONSE_EXAMPLE = {
    "id": 1,
    "full_name": "Admin User",
    "email": "admin@example.com",
    "phone": "9876543210",
    "role": "admin",
    "specialization": None,
    "is_active": True,
    "is_verified": True,
    "created_at": "2026-09-09T10:00:00Z",
}

WORKER_RESPONSE_EXAMPLE = {
    "id": 2,
    "full_name": "Ravi Kumar",
    "email": "ravi@example.com",
    "phone": "9876543210",
    "role": "worker",
    "specialization": "road_maintenance",
    "is_active": True,
    "is_verified": True,
    "created_at": "2026-09-09T10:00:00Z",
}


class UserCreate(BaseModel):
    full_name: str = Field(..., description="Full name of the user")
    email: EmailStr = Field(..., description="Email address (also used for OTP verification)")
    phone: str = Field(..., description="Phone number")
    password: str = Field(..., description="Password")
    role: UserRole = Field(..., description="Registration role: admin or worker")
    specialization: WorkerSpecialization | None = Field(
        None,
        description="Exactly one worker specialization "
        "(required for worker, must be omitted/null for admin)",
    )

    @model_validator(mode="after")
    def validate_role_specialization(self):
        if self.role == UserRole.worker and not self.specialization:
            raise ValueError("Worker role requires a specialization")
        if self.role == UserRole.admin and self.specialization:
            raise ValueError("Admin role must not have a specialization")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                ADMIN_REGISTRATION_EXAMPLE,
                WORKER_REGISTRATION_EXAMPLE,
            ]
        }
    )


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None
    role: UserRole
    specialization: WorkerSpecialization | None = None
    is_active: bool
    is_verified: bool = False
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "examples": [
                ADMIN_RESPONSE_EXAMPLE,
                WORKER_RESPONSE_EXAMPLE,
            ]
        },
    )