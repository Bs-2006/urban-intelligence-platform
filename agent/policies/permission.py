from app.agent.errors.agent_errors import PermissionDeniedError

MATRIX = {
    "list_incidents": ["citizen", "admin", "worker", "transport_officer"],
    "get_incident": ["citizen", "admin", "worker", "transport_officer"],
    "get_incident_stats": ["citizen", "admin", "worker", "transport_officer"],
    "list_users": ["citizen", "admin", "worker", "transport_officer"],
    "list_employees": ["citizen", "admin", "worker", "transport_officer"],
    "list_workers": ["citizen", "admin", "worker", "transport_officer"],
    "get_users_stats": ["citizen", "admin", "worker", "transport_officer"],
    "get_me": ["citizen", "admin", "worker", "transport_officer"],
    "list_work_orders": ["citizen", "admin", "worker", "transport_officer"],
    "get_work_stats": ["citizen", "admin", "worker", "transport_officer"],
}

def check_permission(tool_name: str, role: str):
    allowed = MATRIX.get(tool_name)
    if allowed is None:
        raise PermissionDeniedError(f"Unknown tool {tool_name}")
    if role.lower() not in [r.lower() for r in allowed]:
        raise PermissionDeniedError(f"Role {role} not allowed for {tool_name}")
