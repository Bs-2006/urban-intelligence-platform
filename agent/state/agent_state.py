from pydantic import BaseModel
from typing import Any

class AgentState(BaseModel):
    session_id: str
    user_id: str
    role: str
    messages: list[dict] = []
    pending_confirmation: dict | None = None
    last_tool: str | None = None
    last_tool_result: Any | None = None
