from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class IncidentType(str, enum.Enum):
    pothole = "pothole"  # 🕳️ Potholes
    waterlogging = "waterlogging"  # 🌊 Waterlogging / flooded roads
    damaged_road = "damaged_road"  # 🛣️ Damaged roads
    missing_divider = "missing_divider"  # 🚧 Missing/damaged road dividers
    missing_zebra = "missing_zebra"  # 🚸 Missing/damaged zebra crossings
    damaged_sign = "damaged_sign"  # 🚦 Damaged/missing traffic signs
    traffic_congestion = "traffic_congestion"  # 🚗 Traffic congestion / high vehicle density
    pedestrian_crossing = "pedestrian_crossing"  # 🚶 Pedestrians / school children crossing
    unsafe_driving = "unsafe_driving"  # ⚠️ Unsafe/rash driving
    hit_and_run = "hit_and_run"  # 🚘 Hit-and-run vehicle
    garbage = "garbage"  # 🗑️ Garbage
    streetlight = "streetlight"  # 💡 Streetlight
    other = "other"  # Other


class IncidentSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IncidentStatus(str, enum.Enum):
    reported = "reported"
    pending = "pending"  # unified lifecycle: pending -> in_progress -> resolved
    in_progress = "in_progress"
    resolved = "resolved"
    rejected = "rejected"
    closed = "closed"


class IncidentSource(str, enum.Enum):
    citizen = "citizen"  # Citizen report (reported_by = user)
    ai = "ai"  # AI detection (reported_by = NULL)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    # Core classification - curated road/safety incident types only
    incident_type = Column(Enum(IncidentType), nullable=False, index=True)
    category = Column(String, nullable=True, index=True)  # optional sub-detail (e.g. severity detail, divider type)
    severity = Column(Enum(IncidentSeverity), default=IncidentSeverity.medium)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.reported, index=True)

    # Common content
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Location - unified for all previous venue/road_segment/address
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String, nullable=True)  # venue | road_segment | address
    address = Column(String, nullable=True)

    # Source tracking - citizen/ai unified lifecycle
    source = Column(Enum(IncidentSource), nullable=False, default=IncidentSource.citizen, index=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # citizen -> user id, ai -> NULL

    # Optional linkage - covers previous TrafficData/Event/GPSLog specific fields
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=True, index=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # keep for backward compat, mirrors reported_by for citizen

    # Optional metrics - used for traffic_congestion / unsafe_driving / hit_and_run
    speed_kmh = Column(Float, nullable=True)        # e.g. rash driving speed
    avg_speed_kmh = Column(Float, nullable=True)    # e.g. avg speed during congestion
    vehicle_count = Column(Integer, nullable=True)  # for traffic_congestion
    congestion_level = Column(String, nullable=True)  # low/moderate/high/severe

    # Event time window (also used as occurred_at for other types)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Supabase image storage - key stored in DB
    image_key = Column(String, nullable=True)  # Supabase storage key (e.g. incidents/123/abcd.jpg)

    ai_confidence = Column(Float, nullable=True)  # AI detection confidence

    # Extensible bag for any future fields
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - noload to avoid MissingGreenlet on async sessions
    bus = relationship("Bus", lazy="noload")
    route = relationship("Route", lazy="noload")
    creator = relationship("User", foreign_keys=[created_by], lazy="noload")
    reporter = relationship("User", foreign_keys=[reported_by], lazy="noload")

    @property
    def image_url(self) -> str | None:
        if not self.image_key:
            return None
        if self.image_key.startswith("http://") or self.image_key.startswith("https://"):
            return self.image_key
        try:
            from app.utils.supabase import get_public_url

            return get_public_url(self.image_key)
        except Exception:
            return None
