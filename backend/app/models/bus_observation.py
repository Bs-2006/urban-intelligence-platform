from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base

class BusObservation(Base):
    __tablename__ = "bus_observations"
    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String, nullable=False, index=True)
    route_id = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String, nullable=True)
    occurred_at = Column(DateTime(timezone=True), nullable=True)
    image_path = Column(String, nullable=True)
    image_key = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
