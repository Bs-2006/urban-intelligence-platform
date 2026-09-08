import re
INJECTION_PATTERNS = [re.compile(p, re.I) for p in [r"ignore.*instructions", r"system prompt", r"reveal.*prompt"]]

def check_safety(message: str, plan_tool: str | None, role: str):
    low = message.lower()
    for pat in INJECTION_PATTERNS:
        if pat.search(low):
            raise ValueError("I can't process that request.")
