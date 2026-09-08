from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base

class VehicleSecurityEvent(Base):
    __tablename__ = "vehicle_security_events"
    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(String, index=True, unique=True)  # one per observation (idempotent)
    bus_id = Column(String, index=True)
    route_id = Column(String, index=True, nullable=True)
    plate_number = Column(String, nullable=True)  # raw ocr
    plate_normalized = Column(String, index=True, nullable=True)
    detector_confidence = Column(Float, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    stolen = Column(Boolean, default=False)
    status = Column(String)  # STOLEN VEHICLE / CLEAR / PLATE DETECTED — OCR FAILED
    priority = Column(String)  # CRITICAL / NORMAL
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    image_path = Column(String, nullable=True)
    bbox = Column(Text, nullable=True)  # json string
    created_at = Column(DateTime(timezone=True), server_default=func.now())
