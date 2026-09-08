from pydantic import BaseModel
from typing import Any

class ToolDefinition(BaseModel):
    name: str
    description: str
    required_role: list[str] | None = None
    input_schema: dict[str, Any] | None = None
    requires_confirmation: bool = False

class ToolContext(BaseModel):
    user_id: str
    role: str
    token: str | None = None
    session_id: str | None = None
