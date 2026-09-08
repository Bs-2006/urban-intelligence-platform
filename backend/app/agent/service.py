from app.agent.orchestration.orchestration import orchestrate

async def handle_chat(message: str, session_id: str | None, user_id: str, role: str, token: str | None):
    return await orchestrate(message, session_id, user_id, role, token)
