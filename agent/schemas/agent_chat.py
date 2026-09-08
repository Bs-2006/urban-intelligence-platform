from pydantic import BaseModel, Field

class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    session_id: str | None = None

class AgentChatResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    tool_used: str | None = None
    requires_confirmation: bool = False
    data: dict | None = None

class HistoryItem(BaseModel):
    role: str
    content: str
