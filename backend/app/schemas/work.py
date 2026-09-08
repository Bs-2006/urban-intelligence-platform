from pydantic import BaseModel
from datetime import datetime
from app.models.work import WorkStatus


class WorkOrderCreate(BaseModel):
    incident_id: int | None = None
    assigned_to: int | None = None
    title: str
    description: str | None = None
    due_date: datetime | None = None


class WorkOrderUpdate(BaseModel):
    status: WorkStatus | None = None
    assigned_to: int | None = None
    description: str | None = None


class WorkOrderOut(BaseModel):
    id: int
    incident_id: int | None
    assigned_to: int | None
    created_by: int
    title: str
    description: str | None
    status: WorkStatus
    due_date: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
