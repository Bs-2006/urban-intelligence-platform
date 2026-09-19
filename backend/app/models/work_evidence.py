from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
import enum
from app.database import Base


class WorkOrderEvidence(Base):
    """Completion-proof (After image) attached to a work order.

    Mirrors the incident image pattern: only the storage key is kept in
    PostgreSQL; the raw bytes live in the configured storage (Supabase).
    """

    __tablename__ = "work_order_evidence"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=False, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Supabase storage key (e.g. work/{work_order_id}/{unique}.jpg)
    image_key = Column(String, nullable=False)

    # Useful metadata (no binary data stored in PostgreSQL)
    original_filename = Column(String, nullable=True)
    content_type = Column(String, nullable=True)
    image_size = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

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