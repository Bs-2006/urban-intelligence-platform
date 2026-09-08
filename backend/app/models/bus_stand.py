from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# Many-to-many: routes <-> bus_stands
route_stands = Table(
    "route_stands",
    Base.metadata,
    Column("route_id", Integer, ForeignKey("routes.id"), primary_key=True),
    Column("stand_id", Integer, ForeignKey("bus_stands.id"), primary_key=True),
    Column("stop_order", Integer, nullable=False),
)


class BusStand(Base):
    __tablename__ = "bus_stands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    routes = relationship("Route", secondary=route_stands, backref="stops", lazy="noload")
