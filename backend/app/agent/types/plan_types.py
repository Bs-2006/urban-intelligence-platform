from pydantic import BaseModel
from typing import Any

class ToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = {}

class AgentPlan(BaseModel):
    intent: str
    tool_name: str | None = None
    arguments: dict[str, Any] = {}
    requires_confirmation: bool = False
    reasoning_summary: str = ""
    is_greeting: bool = False
    needs_auth: bool = False
    multi_tool: bool = False

class ToolResult(BaseModel):
    success: bool
    data: Any = None
    error: str | None = None
    status_code: int | None = None

class AgentResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    tool_used: str | None = None
    requires_confirmation: bool = False
    data: Any = None
