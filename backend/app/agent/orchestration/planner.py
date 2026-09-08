import re
from app.agent.types.agent_types import Intent
from app.agent.types.plan_types import AgentPlan
from app.core.llm import chat_completion_json
from app.agent.prompts.agent_prompt import SYSTEM_PROMPT, PLANNER_USER_TEMPLATE

GREETING_KEYWORDS = {"hi","hello","hey","greetings","how are you","good morning","good afternoon"}

def _is_greeting(msg: str) -> bool:
    low = msg.strip().lower()
    return low in GREETING_KEYWORDS or (len(low.split()) <= 3 and any(k in low for k in ["hi","hello","hey"]))

def _extract_incident_args(msg: str) -> dict:
    low = msg.lower()
    args = {}
    # incident_type
    types = ["pothole","waterlogging","damaged_road","missing_divider","missing_zebra","damaged_sign","traffic_congestion","pedestrian_crossing","unsafe_driving","hit_and_run","garbage","streetlight","other"]
    for t in types:
        if t in low or t.replace("_"," ") in low:
            args["incident_type"] = t
            break
    # status
    for s in ["pending","in_progress","resolved","reported","rejected","closed"]:
        if s in low:
            args["status"] = s
            break
    # source
    if "citizen" in low or "reported by citizen" in low:
        args["source"] = "citizen"
    elif "ai" in low or "detected by ai" in low or "model" in low:
        args["source"] = "ai"
    # severity
    for sev in ["critical","high","medium","low"]:
        if sev in low:
            args["severity"] = sev
            break
    return args

def _extract_work_args(msg: str) -> dict:
    low = msg.lower()
    args = {}
    # Prioritize completed/in_progress over assigned for phrases like "assigned by manager completed"
    for s in ["completed","in_progress","cancelled","assigned","pending"]:
        if s in low:
            # Map pending -> assigned for work (work has no pending, uses assigned)
            args["status"] = "assigned" if s == "pending" else s
            break
    m = re.search(r"incident\s*(\d+)", low)
    if m:
        args["incident_id"] = int(m.group(1))
    # Handle "assigned to 5", "assigned to employee 5", "assigned to worker 5"
    m2 = re.search(r"assigned to\s*(?:employee|worker)?\s*(\d+)", low)
    if m2:
        args["assigned_to"] = int(m2.group(1))
    elif re.search(r"employee\s*(\d+)", low):
        m3 = re.search(r"employee\s*(\d+)", low)
        if m3:
            args["assigned_to"] = int(m3.group(1))
    elif re.search(r"worker\s*(\d+)", low):
        m3 = re.search(r"worker\s*(\d+)", low)
        if m3:
            args["assigned_to"] = int(m3.group(1))
    return args

async def plan(message: str, role: str, history: list) -> AgentPlan:
    if _is_greeting(message):
        return AgentPlan(intent=Intent.GREETING.value, tool_name=None, arguments={}, is_greeting=True, reasoning_summary="Greeting")
    low = message.lower()
    # Distinguish count/statistics language from list/record language
    COUNT_KEYWORDS = ["how many", "count", "statistics", "statistic", "breakdown", "number of"]
    LIST_KEYWORDS = ["show me", "show", "list", "display", "give me", "which", "get ", "fetch"]
    is_count_request = any(k in low for k in COUNT_KEYWORDS)
    is_list_request = any(k in low for k in LIST_KEYWORDS)

    # Work assigned to employee/worker must be checked before generic employee/worker list (most specific)
    if "work" in low and any(k in low for k in ["employee", "worker"]) and "assigned" in low:
        w_args = _extract_work_args(message)
        if is_count_request:
            return AgentPlan(intent=Intent.GET_WORK_STATS.value, tool_name="get_work_stats", arguments=w_args, reasoning_summary="Work assigned to employee stats")
        return AgentPlan(intent=Intent.LIST_WORK_ORDERS.value, tool_name="list_work_orders", arguments=w_args, reasoning_summary="Work assigned to employee list")
    # Workers / Employees - must be checked before generic work to avoid "workers" containing "work"
    if "workers" in low:
        if is_count_request:
            return AgentPlan(intent=Intent.GET_USERS_STATS.value, tool_name="get_users_stats", arguments={}, reasoning_summary="Workers count heuristic")
        return AgentPlan(intent=Intent.LIST_WORKERS.value, tool_name="list_workers", arguments={"role":"worker"}, reasoning_summary="Workers list heuristic")
    if "employee" in low:
        if any(k in low for k in ["how many", "count", "number of"]):
            return AgentPlan(intent=Intent.GET_USERS_STATS.value, tool_name="get_users_stats", arguments={}, reasoning_summary="Employees count stats heuristic")
        return AgentPlan(intent=Intent.LIST_EMPLOYEES.value, tool_name="list_employees", arguments={"role":"worker"}, reasoning_summary="Employee list heuristic")
    # Users - count vs list
    if any(k in low for k in ["how many", "count", "number of"]) and "user" in low and "worker" not in low and "employee" not in low:
        return AgentPlan(intent=Intent.GET_USERS_STATS.value, tool_name="get_users_stats", arguments={}, reasoning_summary="Users stats heuristic")
    if "user" in low and any(k in low for k in ["list","show","display"]):
        return AgentPlan(intent=Intent.LIST_USERS.value, tool_name="list_users", arguments={}, reasoning_summary="Users list heuristic")
    # Heuristic for work stats - count language, but not for workers/employees (handled above)
    if is_count_request and "work" in low:
        args = _extract_work_args(message)
        return AgentPlan(intent=Intent.GET_WORK_STATS.value, tool_name="get_work_stats", arguments=args, reasoning_summary="Work stats heuristic")
    # Heuristic fallback for incident stats - ONLY on count/statistics language, never on pending/pothole alone
    if is_count_request:
        incident_types = ["pothole","waterlogging","damaged_road","missing_divider","missing_zebra","damaged_sign","traffic_congestion","pedestrian_crossing","unsafe_driving","hit_and_run","garbage","streetlight","other"]
        has_incident_context = "incident" in low or "complaint" in low or any(t in low or t.replace("_"," ") in low for t in incident_types) or any(s in low for s in ["pending","resolved","in_progress","reported","rejected","closed","citizen","detected by ai","model"]) or "severity" in low
        if has_incident_context:
            args = _extract_incident_args(message)
            return AgentPlan(intent=Intent.GET_INCIDENT_STATS.value, tool_name="get_incident_stats", arguments=args, reasoning_summary="Stats heuristic")
    # Natural incident-listing variations (deterministic, no LLM)
    # Must handle: "What problems are currently reported in the city?" etc. without calling LLM
    # If count language -> stats (handled above), otherwise these WHAT/WHICH questions are list
    problem_words = ["problem", "problems", "issue", "issues", "incident", "incidents"]
    has_problem_word = any(w in low for w in problem_words)
    # Core list triggers for natural questions: what/which/tell me/are there/is there/show me the current problems etc.
    is_natural_list_question = any(k in low for k in ["what ", "which ", "tell me", "are there", "is there", "what is happening", "happening in the city", "in the city", "reported in the city", "currently reported"])
    # Explicit list words already in is_list_request, but also handle natural WHAT questions
    if has_problem_word and is_natural_list_question and not is_count_request:
        # Distinguish from stats: "How many problems are reported?" has is_count_request True, already handled as stats above, so this is only for list
        args = _extract_incident_args(message)
        # If message contains "reported" but no status, treat as reported status filter
        if "reported" in low and not args.get("status"):
            args["status"] = "reported"
        return AgentPlan(intent=Intent.LIST_INCIDENTS.value, tool_name="list_incidents", arguments=args, reasoning_summary="Natural incident list heuristic")
    # Also handle "What is happening in the city?" without problem word but with happening/city
    if ("what is happening" in low or "happening in the city" in low) and not is_count_request:
        return AgentPlan(intent=Intent.LIST_INCIDENTS.value, tool_name="list_incidents", arguments={}, reasoning_summary="City happening list heuristic")
    # Heuristic for work list - must be checked before incident status-alone to avoid "pending work" misrouting to incidents
    if "work" in low and is_list_request:
        args = _extract_work_args(message)
        return AgentPlan(intent=Intent.LIST_WORK_ORDERS.value, tool_name="list_work_orders", arguments=args, reasoning_summary="Work list heuristic")
    # Fallback for work status queries without explicit list keywords (e.g., "Is the work assigned by the manager completed?")
    if "work" in low:
        w_args = _extract_work_args(message)
        if w_args.get("status") or w_args.get("assigned_to") or w_args.get("incident_id"):
            if is_count_request:
                return AgentPlan(intent=Intent.GET_WORK_STATS.value, tool_name="get_work_stats", arguments=w_args, reasoning_summary="Work stats via status fallback")
            return AgentPlan(intent=Intent.LIST_WORK_ORDERS.value, tool_name="list_work_orders", arguments=w_args, reasoning_summary="Work list via status fallback")
    # Heuristic for incident list - list language without count language, must not be misrouted to stats
    if is_list_request:
        if any(w in low for w in ["incident", "incidents", "complaint", "complaints", "problem", "problems", "issue", "issues"]):
            args = _extract_incident_args(message)
            return AgentPlan(intent=Intent.LIST_INCIDENTS.value, tool_name="list_incidents", arguments=args, reasoning_summary="List heuristic")
        # Also handle "pending incidents" without explicit "incident" word? Check for status alone with list
        if any(s in low for s in ["pending","resolved","in_progress","reported","rejected","closed"]):
            # If list keywords + status, treat as list
            args = _extract_incident_args(message)
            return AgentPlan(intent=Intent.LIST_INCIDENTS.value, tool_name="list_incidents", arguments=args, reasoning_summary="List heuristic via status")
    if "profile" in low:
        return AgentPlan(intent=Intent.GET_ME.value, tool_name="get_me", arguments={}, reasoning_summary="Profile heuristic")

    # LLM planning
    try:
        hist_str = "\n".join([f"{h.get('role')}: {h.get('content')}" for h in history[-6:]])
        msgs = [{"role":"system","content":SYSTEM_PROMPT},{"role":"user","content":PLANNER_USER_TEMPLATE.format(role=role, message=message, history=hist_str)}]
        data = await chat_completion_json(msgs)
        return AgentPlan(
            intent=data.get("intent", Intent.UNKNOWN.value),
            tool_name=data.get("tool_name"),
            arguments=data.get("arguments",{}),
            requires_confirmation=bool(data.get("requires_confirmation", False)),
            reasoning_summary=data.get("reasoning_summary",""),
            is_greeting=bool(data.get("is_greeting", False)),
        )
    except Exception as e:
        # Fallback to general list
        if "incident" in low:
            return AgentPlan(intent=Intent.LIST_INCIDENTS.value, tool_name="list_incidents", arguments={}, reasoning_summary=f"Fallback: {e}")
        return AgentPlan(intent=Intent.UNKNOWN.value, tool_name=None, arguments={}, reasoning_summary="Unknown fallback")
