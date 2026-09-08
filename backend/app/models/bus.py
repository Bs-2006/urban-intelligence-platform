from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Bus(Base):
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True)
    bus_number = Column(String, unique=True, nullable=False, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    capacity = Column(Integer, default=50)
    is_active = Column(Boolean, default=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    route = relationship("Route", backref="buses", lazy="noload")
    driver = relationship("User", backref="assigned_buses", lazy="noload")
