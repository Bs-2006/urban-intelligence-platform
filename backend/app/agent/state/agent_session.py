import uuid
from app.agent.state.agent_state import AgentState
_store: dict[str, AgentState] = {}
SESSION_TTL = 3600

def get_session(session_id: str | None, user_id: str, role: str) -> AgentState:
    if session_id and session_id in _store:
        s = _store[session_id]
        s.user_id = user_id
        s.role = role
        return s
    sid = session_id or str(uuid.uuid4())
    state = AgentState(session_id=sid, user_id=user_id, role=role)
    _store[sid] = state
    return state

def save_session(state: AgentState):
    _store[state.session_id] = state

def clear_expired():
    pass
