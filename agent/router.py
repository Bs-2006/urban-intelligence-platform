from fastapi import APIRouter, Depends, Header
from app.agent.schemas.agent_chat import AgentChatRequest, AgentChatResponse
from app.agent.service import handle_chat
from app.dependencies import get_current_user
import app.agent.tools.incidents.incident_tools  # noqa
import app.agent.tools.work.work_tools  # noqa
import app.agent.tools.users.user_tools  # noqa

router = APIRouter(prefix="/api/agent", tags=["Agent"])

@router.post("/chat", response_model=AgentChatResponse)
async def chat(body: AgentChatRequest, current_user: dict = Depends(get_current_user), authorization: str | None = Header(default=None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    user_id = str(current_user.get("sub"))
    role = current_user.get("role", "citizen")
    result = await handle_chat(body.message, body.session_id, user_id, role, token)
    return AgentChatResponse(**result)

@router.get("/health")
def health():
    return {"status": "ok", "agent": "ready"}
