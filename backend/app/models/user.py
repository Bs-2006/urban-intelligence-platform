from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    worker = "worker"


class WorkerSpecialization(str, enum.Enum):
    road_maintenance = "road_maintenance"
    drainage_waterlogging = "drainage_waterlogging"
    infrastructure = "infrastructure"
    traffic_management = "traffic_management"
    traffic_enforcement = "traffic_enforcement"
    road_safety = "road_safety"
    traffic_sign_maintenance = "traffic_sign_maintenance"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    specialization = Column(Enum(WorkerSpecialization), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    otp_hash = Column(String, nullable=True)
    otp_expires_at = Column(DateTime(timezone=True), nullable=True)
    otp_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
