# READ-ONLY dashboard assistant: no state-changing operations, no confirmation required.
STATE_CHANGING: set[str] = set()

def requires_confirmation(tool_name: str) -> bool:
    return False

def is_confirmation_message(msg: str) -> bool:
    return msg.strip().lower() in ("yes", "y", "confirm", "yes please", "submit", "proceed", "ok", "okay")

def is_rejection_message(msg: str) -> bool:
    return msg.strip().lower() in ("no", "n", "cancel", "nope", "abort", "stop")
