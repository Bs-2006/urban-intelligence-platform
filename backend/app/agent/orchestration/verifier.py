def verify(tool_name: str, result: dict) -> tuple[bool, str]:
    if not result.get("success"):
        return False, result.get("error", "Tool failed")
    data = result.get("data")
    if tool_name in ("get_incident_stats", "get_work_stats"):
        if data is None or "total" not in data:
            return False, "No stats data"
    if tool_name in ("list_incidents", "list_work_orders", "list_employees"):
        if data is None:
            return False, "No data"
    return True, ""
