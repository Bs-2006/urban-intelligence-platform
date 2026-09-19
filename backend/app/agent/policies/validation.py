from app.agent.errors.agent_errors import ValidationError
from datetime import datetime

VALID_INCIDENT_TYPES = {"pothole","waterlogging","damaged_road","missing_divider","missing_zebra","damaged_sign","traffic_congestion","pedestrian_crossing","unsafe_driving","hit_and_run","garbage","streetlight","other"}
VALID_SEVERITIES = {"low","medium","high","critical"}
VALID_STATUSES = {"reported","pending","in_progress","resolved","rejected","closed"}
VALID_WORK_STATUSES = {"assigned","in_progress","completed","cancelled"}
VALID_SOURCES = {"citizen","ai"}
VALID_ROLES = {"admin", "worker"}

def _is_valid_date(s: str) -> bool:
    try:
        datetime.fromisoformat(s.replace("Z","+00:00"))
        return True
    except:
        return False

def validate(tool_name: str, args: dict):
    # READ-ONLY: only validation for read operations
    if tool_name == "get_incident":
        if not args.get("incident_id"):
            raise ValidationError("incident_id required")
    elif tool_name in ("get_incident_stats","get_work_stats","list_incidents","list_work_orders","list_employees","list_workers","list_users","get_users_stats"):
        # read-only, optional filters - validate enums if provided
        if args.get("source") and args["source"] not in VALID_SOURCES:
            raise ValidationError("source must be citizen|ai")
        if args.get("incident_type") and args["incident_type"] not in VALID_INCIDENT_TYPES:
            raise ValidationError("invalid incident_type")
        if args.get("status"):
            pass
        if tool_name in ("list_users","list_employees","list_workers") and args.get("role") and args["role"] not in VALID_ROLES:
            raise ValidationError("role must be admin|worker")
