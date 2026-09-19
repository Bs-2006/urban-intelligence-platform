from app.agent.errors.agent_errors import PermissionDeniedError

MATRIX = {
    "list_incidents": ["admin", "worker"],
    "get_incident": ["admin", "worker"],
    "get_incident_stats": ["admin", "worker"],
    "list_users": ["admin", "worker"],
    "list_employees": ["admin", "worker"],
    "list_workers": ["admin", "worker"],
    "get_users_stats": ["admin", "worker"],
    "get_me": ["admin", "worker"],
    "list_work_orders": ["admin", "worker"],
    "get_work_stats": ["admin", "worker"],
}

def check_permission(tool_name: str, role: str):
    allowed = MATRIX.get(tool_name)
    if allowed is None:
        raise PermissionDeniedError(f"Unknown tool {tool_name}")
    if role.lower() not in [r.lower() for r in allowed]:
        raise PermissionDeniedError(f"Role {role} not allowed for {tool_name}")
