from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any


class WorkEvidenceOut(BaseModel):
    id: int
    work_order_id: int
    uploaded_by: int
    image_url: str | None = None  # computed public storage URL (before/after proof)
    original_filename: str | None = None
    content_type: str | None = None
    image_size: int | None = None
    metadata_json: dict[str, Any] | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)