from app.agent.state.agent_session import get_session, save_session
from app.agent.policies.safety import check_safety
from app.agent.policies.permission import check_permission
from app.agent.policies.validation import validate
from app.agent.orchestration.planner import plan
from app.agent.orchestration.executor import execute
from app.agent.orchestration.verifier import verify
from app.agent.types.tool_types import ToolContext
from app.core.llm import chat_completion

def _format_incidents_list(data: dict, user_message: str) -> str:
    incidents = data.get("incidents") if isinstance(data, dict) else None
    if incidents is None and isinstance(data, list):
        incidents = data
    if not incidents:
        # Use status from user_message if available, otherwise generic
        low = user_message.lower() if user_message else ""
        if "pending" in low:
            return "There are no pending incidents."
        if "resolved" in low:
            return "There are no resolved incidents."
        return "There are no incidents found."
    # Determine header from user_message
    low = user_message.lower() if user_message else ""
    if "pending" in low:
        header = f"There are {len(incidents)} pending incidents:"
    elif "resolved" in low:
        header = f"There are {len(incidents)} resolved incidents:"
    elif "in_progress" in low or "in progress" in low:
        header = f"There are {len(incidents)} in-progress incidents:"
    else:
        header = f"There are {len(incidents)} incidents:"
    lines = [header]
    for inc in incidents:
        iid = inc.get("id", "?")
        title = inc.get("title") or inc.get("incident_type", "Incident")
        sev = inc.get("severity", "")
        sev_str = f" – {sev.capitalize()} severity" if sev else ""
        lines.append(f"• #{iid} – {title}{sev_str}")
    return "\n".join(lines)

def _format_incident_stats(data: dict, user_message: str) -> str:
    if not isinstance(data, dict):
        return "There are no incidents found."
    total = data.get("total", 0)
    if total == 0:
        return "There are no incidents found."
    by_status = data.get("by_status", {}) or {}
    by_source = data.get("by_source", {}) or {}
    # Check if user asked for specific breakdown
    low = user_message.lower() if user_message else ""
    # Simple total with pending/resolved breakdown if available
    pending = by_status.get("pending", 0)
    resolved = by_status.get("resolved", 0)
    in_progress = by_status.get("in_progress", 0)
    # Build concise sentence
    parts = []
    if pending and resolved:
        parts.append(f"{pending} are pending and {resolved} are resolved")
    elif pending:
        parts.append(f"{pending} are pending")
    elif resolved:
        parts.append(f"{resolved} are resolved")
    if in_progress and "in-progress" not in " ".join(parts):
        parts.append(f"{in_progress} are in progress")
    if parts:
        breakdown = " and ".join(parts) if len(parts) == 1 else ", ".join(parts[:-1]) + f" and {parts[-1]}"
        # Capitalize first letter already in "There are"
        return f"There are {total} incidents in total. {breakdown.capitalize()}."
    return f"There are {total} incidents in total."

def _format_users_stats(data: dict) -> str:
    if not isinstance(data, dict):
        return "There are no users found."
    total = data.get("total", 0)
    by_role = data.get("by_role", {}) or {}
    admin = by_role.get("admin", 0)
    worker = by_role.get("worker", 0)
    if total == 0:
        return "There are no users found."
    lines = [f"There are {total} users in the system:"]
    if admin:
        lines.append(f"• {admin} admins")
    if worker:
        lines.append(f"• {worker} workers")
    if len(lines) == 1:
        return f"There are {total} users in the system."
    return "\n".join(lines)

def _format_employees_list(data: dict) -> str:
    employees = None
    if isinstance(data, dict):
        employees = data.get("employees") or data.get("users") or data.get("workers")
        count = data.get("count", len(employees) if employees else 0)
    elif isinstance(data, list):
        employees = data
        count = len(data)
    else:
        count = 0
    if not employees:
        return "There are no employees found."
    # employees is list of user dicts with full_name
    lines = [f"There are {count} employees:"]
    for emp in employees:
        name = emp.get("full_name") or emp.get("name") or emp.get("email") or str(emp.get("id",""))
        if name:
            lines.append(f"• {name}")
    return "\n".join(lines)

def _format_users_list(data: dict) -> str:
    users = None
    if isinstance(data, dict):
        users = data.get("users") or data.get("employees")
        count = data.get("count", len(users) if users else 0)
    elif isinstance(data, list):
        users = data
        count = len(data)
    else:
        count = 0
    if not users:
        return "There are no users found."
    lines = [f"There are {count} users:"]
    for u in users[:10]:
        name = u.get("full_name") or u.get("email") or str(u.get("id",""))
        lines.append(f"• {name}")
    if len(users) > 10:
        lines.append(f"• ...and {len(users)-10} more")
    return "\n".join(lines)

def _format_work_list(data: dict, user_message: str) -> str:
    orders = None
    if isinstance(data, dict):
        orders = data.get("work_orders") or data.get("workOrders")
        if orders is None and isinstance(data, list):
            orders = data
    elif isinstance(data, list):
        orders = data
    if not orders:
        low = user_message.lower() if user_message else ""
        if "completed" in low:
            return "There are no completed work orders."
        if "pending" in low:
            return "There are no pending work orders."
        return "There are no work orders found."
    low = user_message.lower() if user_message else ""
    if "completed" in low:
        header = "Here are the completed work orders:"
    elif "pending" in low:
        header = "Here are the pending work orders:"
    elif "in_progress" in low or "in progress" in low:
        header = "Here are the in-progress work orders:"
    else:
        header = f"There are {len(orders)} work orders:"
    lines = [header]
    for w in orders:
        title = w.get("title") or f"Work #{w.get('id','')}"
        status = w.get("status", "")
        lines.append(f"• {title} – {status}" if status else f"• {title}")
    return "\n".join(lines)

def _format_work_stats(data: dict, user_message: str) -> str:
    if not isinstance(data, dict):
        return "There are no work orders found."
    by_status = data.get("by_status", {}) or {}
    total = data.get("total")
    if total is None:
        total = sum(by_status.values()) if by_status else 0
    low = user_message.lower() if user_message else ""
    # Special handling for "Is the work assigned by the manager completed?"
    if "is the work" in low and "completed" in low:
        completed = by_status.get("completed", 0)
        in_progress = by_status.get("in_progress", 0) or by_status.get("assigned", 0)
        pending = by_status.get("pending", 0)
        if completed and not in_progress and not pending:
            # Check by_assignee if available
            return "Yes. The assigned work order has been completed."
        if in_progress or by_status.get("in_progress") or by_status.get("assigned"):
            return "Not yet. The work order is currently in progress."
        if pending:
            return "Not yet. The work order is currently pending."
        if completed:
            return "Yes. The assigned work order has been completed."
        return "There are no work orders found."
    if "how many" in low and "completed" in low:
        completed = by_status.get("completed", 0)
        return f"There are {completed} completed work orders out of {total} total."
    # Generic stats
    if by_status:
        parts = []
        for k in ["pending","assigned","in_progress","completed","cancelled"]:
            if k in by_status:
                parts.append(f"{by_status[k]} {k}")
        if parts:
            return f"There are {total} work orders in total: " + ", ".join(parts) + "."
    return f"There are {total} work orders in total."

async def _greeting_response():
    # Fixed natural greeting as per example, no LLM needed
    return "Hi! 👋 How can I help you with the urban management dashboard?"

async def _general_chat(message, history):
    msgs=[{"role":"system","content":"You are Urban Intelligence Assistant. Answer helpfully, scope is urban incidents, work orders, buses, routes. Be concise."}]
    for h in history[-4:]:
        msgs.append({"role": h.get("role","user"), "content": h.get("content","")})
    msgs.append({"role":"user","content":message})
    try:
        return await chat_completion(msgs, temperature=0.7, max_tokens=200)
    except:
        return "I can help with incidents, work orders, and employees. Try: 'Show pending incidents' or 'How many incidents are there?'"

async def _natural_response(tool_name, result, user_message, history):
    data = result.get("data")
    # Deterministic human-friendly formatting for all read-only tools
    try:
        if tool_name == "list_incidents":
            return _format_incidents_list(data, user_message)
        if tool_name == "get_incident_stats":
            return _format_incident_stats(data, user_message)
        if tool_name == "get_users_stats":
            return _format_users_stats(data)
        if tool_name == "list_employees":
            return _format_employees_list(data)
        if tool_name == "list_workers":
            # Same as employees but label workers
            emp_data = data
            if isinstance(data, dict) and "employees" in data:
                emp_data = {"employees": data["employees"], "count": data["count"]}
            text = _format_employees_list(emp_data)
            # Replace "employees" with "workers" if user asked for workers
            if user_message and "worker" in user_message.lower():
                return text.replace("employees", "workers").replace("Employees", "Workers")
            return text
        if tool_name == "list_users":
            return _format_users_list(data)
        if tool_name == "get_me":
            if isinstance(data, dict):
                name = data.get("full_name") or "User"
                email = data.get("email", "")
                role = data.get("role", "")
                return f"You are {name} ({email}) with role {role}." if email else f"You are {name}."
            return "Here is your profile information."
        if tool_name == "list_work_orders":
            return _format_work_list(data, user_message)
        if tool_name == "get_work_stats":
            return _format_work_stats(data, user_message)
        if tool_name == "get_incident" and isinstance(data, dict):
            iid = data.get("id", "")
            title = data.get("title", "Incident")
            status = data.get("status", "")
            sev = data.get("severity", "")
            return f"Incident #{iid} – {title} is currently {status} with {sev} severity."
    except Exception:
        pass
    # Fallback to LLM with strict instruction to not expose raw output
    msgs=[{"role":"system","content":"You are Urban Intelligence Platform dashboard assistant. Respond in NORMAL NATURAL LANGUAGE like a human. Never expose raw tool output, dictionaries, JSON, tool names or intent names. Summarize the actual data in simple clear English with bullet points and numbers. Keep concise. Never hallucinate."},
          {"role":"user","content":f"User asked: {user_message}\nTool {tool_name} returned data: {str(data)[:3000]}\nGenerate natural helpful response. Do not invent data. Use bullet points for lists."}]
    try:
        return await chat_completion(msgs, temperature=0.7, max_tokens=300)
    except:
        # Final fallback without LLM
        if isinstance(data, dict) and "total" in data:
            return f"There are {data.get('total',0)} records found."
        return "Here are the results."

async def orchestrate(message: str, session_id: str | None, user_id: str, role: str, token: str | None):
    check_safety(message, None, role)
    session = get_session(session_id, user_id, role)
    history = session.messages

    # READ-ONLY: no pending confirmation handling (all operations are read-only)

    # Plan
    agent_plan = await plan(message, role, history)
    if agent_plan.is_greeting or agent_plan.intent == "GREETING":
        txt = await _greeting_response()
        session.messages.append({"role":"user","content":message})
        session.messages.append({"role":"assistant","content":txt})
        save_session(session)
        return {"success": True, "message": txt, "session_id": session.session_id}
    if agent_plan.intent == "UNKNOWN" or not agent_plan.tool_name:
        txt = await _general_chat(message, history)
        session.messages.append({"role":"user","content":message})
        session.messages.append({"role":"assistant","content":txt})
        save_session(session)
        return {"success": True, "message": txt, "session_id": session.session_id}

    check_safety(message, agent_plan.tool_name, role)

    # READ-ONLY: no confirmation gate - all operations execute directly
    ctx = ToolContext(user_id=user_id, role=role, token=token, session_id=session.session_id)
    result = await execute(agent_plan.tool_name, agent_plan.arguments, ctx)
    ok, msg = verify(agent_plan.tool_name, result)
    if not ok:
        session.messages.append({"role":"user","content":message})
        session.messages.append({"role":"assistant","content":msg})
        save_session(session)
        return {"success": False, "message": msg, "session_id": session.session_id}
    session.last_tool = agent_plan.tool_name
    session.last_tool_result = result
    session.messages.append({"role":"user","content":message})
    nat = await _natural_response(agent_plan.tool_name, result, message, history)
    session.messages.append({"role":"assistant","content":nat})
    save_session(session)
    return {"success": True, "message": nat, "session_id": session.session_id, "tool_used": agent_plan.tool_name, "data": result.get("data")}
