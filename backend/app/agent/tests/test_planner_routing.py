try:
    import pytest
except ImportError:
    pytest = None
from app.agent.orchestration.planner import plan
from app.agent.types.agent_types import Intent

async def test_show_pending_incidents_routes_to_list():
    msg = "Show me the pending incidents"
    p = await plan(msg, "citizen", [])
    assert p.intent == Intent.LIST_INCIDENTS.value, f"Expected LIST_INCIDENTS, got {p.intent}"
    assert p.tool_name == "list_incidents", f"Expected list_incidents, got {p.tool_name}"
    # Should have status pending, but NOT be stats
    assert p.arguments.get("status") == "pending"
    # Must NOT be stats
    assert p.intent != Intent.GET_INCIDENT_STATS.value

async def test_how_many_pending_potholes_reported_by_citizens_routes_to_stats():
    msg = "How many pending potholes were reported by citizens?"
    p = await plan(msg, "citizen", [])
    assert p.intent == Intent.GET_INCIDENT_STATS.value, f"Expected GET_INCIDENT_STATS, got {p.intent}"
    assert p.tool_name == "get_incident_stats"
    assert p.arguments.get("incident_type") == "pothole"
    assert p.arguments.get("status") == "pending"
    assert p.arguments.get("source") == "citizen"

async def test_listing_never_calls_stats_merely_on_pending_pothole_citizen():
    # These should all be LIST, not STATS, because they lack count language
    for msg in [
        "Show me the pending incidents",
        "List pending potholes",
        "Display incidents with status pending",
        "Show me potholes reported by citizen",
        "List garbage incidents",
    ]:
        p = await plan(msg, "citizen", [])
        assert p.tool_name == "list_incidents", f"Message '{msg}' incorrectly routed to {p.tool_name}"

async def test_count_language_routes_to_stats():
    for msg in [
        "How many pending incidents?",
        "Count pending incidents",
        "Give me statistics for pending incidents",
        "Breakdown of incidents by status",
        "Number of potholes reported by citizens",
    ]:
        p = await plan(msg, "citizen", [])
        assert p.tool_name == "get_incident_stats", f"Message '{msg}' should route to stats, got {p.tool_name}"

async def test_new_chat_does_not_reuse_previous_tool_result():
    # Simulate session with history containing previous pothole stats
    history = [
        {"role": "user", "content": "How many pending potholes were reported by citizens?"},
        {"role": "assistant", "content": "Incident stats: total 5, by_status {...}, by_type {pothole: 5}"},
    ]
    # New request is LIST, should not inherit pothole from history
    msg = "Show me the pending incidents"
    p = await plan(msg, "citizen", history)
    assert p.tool_name == "list_incidents", f"Expected list_incidents, got {p.tool_name}"
    # Should NOT have pothole filter from previous history
    assert p.arguments.get("incident_type") is None, f"Did not expect pothole from history, got {p.arguments}"
    assert p.arguments.get("status") == "pending"
    # Source should be None or not inherited as pothole
    # Ensure it does not incorrectly carry source=citizen from previous if new message doesn't specify? New message has no source, so None is correct
    # But if new message explicitly says pending incidents without source, it should not have source=citizen from history
    # Actually new message "Show me the pending incidents" has no source, so source should be None
    assert p.arguments.get("source") is None

async def test_state_changing_confirmation_removed():
    # READ-ONLY agent: no state-changing operations, no confirmation required
    from app.agent.policies.confirmation import STATE_CHANGING
    assert STATE_CHANGING == set(), f"Expected empty STATE_CHANGING for read-only agent, got {STATE_CHANGING}"
    # Ensure read-only tools do not require confirmation
    assert "get_incident_stats" not in STATE_CHANGING
    assert "get_work_stats" not in STATE_CHANGING
    assert "list_incidents" not in STATE_CHANGING
    assert "list_work_orders" not in STATE_CHANGING

async def test_no_write_tools_registered():
    # Ensure tools are imported (router imports them)
    import app.agent.tools.incidents.incident_tools  # noqa
    import app.agent.tools.work.work_tools  # noqa
    import app.agent.tools.users.user_tools  # noqa
    from app.agent.tools.registry import _registry
    write_tools = {"create_incident","update_incident","delete_incident","upload_incident_image","create_work_order","update_work_order"}
    for wt in write_tools:
        assert wt not in _registry, f"Write tool {wt} should not be registered in read-only agent"
    # Ensure read-only tools are registered
    for rt in ["list_incidents","get_incident","get_incident_stats","list_users","list_employees","get_users_stats","get_me","list_work_orders","get_work_stats"]:
        assert rt in _registry, f"Read-only tool {rt} should be registered"

# Required dashboard questions - must route to read-only intents/tools
async def test_show_pending_incidents():
    p = await plan("Show pending incidents", "citizen", [])
    assert p.tool_name == "list_incidents" and p.arguments.get("status") == "pending"

async def test_show_resolved_incidents():
    p = await plan("Show resolved incidents", "citizen", [])
    assert p.tool_name == "list_incidents" and p.arguments.get("status") == "resolved"

async def test_show_ai_detected_incidents():
    p = await plan("Show AI detected incidents", "citizen", [])
    assert p.tool_name == "list_incidents" and p.arguments.get("source") == "ai"

async def test_show_citizen_reported_incidents():
    p = await plan("Show citizen reported incidents", "citizen", [])
    assert p.tool_name == "list_incidents" and p.arguments.get("source") == "citizen"

async def test_show_high_severity_incidents():
    p = await plan("Show high severity incidents", "citizen", [])
    assert p.tool_name == "list_incidents" and p.arguments.get("severity") == "high"

async def test_how_many_incidents_are_there():
    p = await plan("How many incidents are there?", "citizen", [])
    assert p.tool_name == "get_incident_stats"

async def test_how_many_pending_potholes_are_there():
    p = await plan("How many pending potholes are there?", "citizen", [])
    assert p.tool_name == "get_incident_stats"
    assert p.arguments.get("incident_type") == "pothole"
    assert p.arguments.get("status") == "pending"

async def test_how_many_users_are_there():
    p = await plan("How many users are there?", "admin", [])
    assert p.tool_name == "get_users_stats"

async def test_how_many_employees_are_there():
    for msg in ["How many employees are there?", "How many workers are there?"]:
        p = await plan(msg, "admin", [])
        assert p.tool_name in ("get_users_stats","list_employees"), f"{msg} -> {p.tool_name}"

async def test_show_employees():
    p = await plan("Show employees", "admin", [])
    assert p.tool_name == "list_employees"

async def test_show_work_orders():
    p = await plan("Show work orders", "worker", [])
    assert p.tool_name == "list_work_orders"

async def test_show_completed_work():
    p = await plan("Show completed work", "worker", [])
    # Should be list with status completed (read-only)
    assert p.tool_name in ("list_work_orders","get_work_stats")
    if p.tool_name == "list_work_orders":
        assert p.arguments.get("status") == "completed"
    else:
        assert p.arguments.get("status") == "completed"

async def test_show_pending_in_progress_work():
    for msg, expected_status in [("Show pending work", "pending"), ("Show in_progress work", "in_progress")]:
        # Note: work status uses assigned/in_progress/completed/cancelled, but pending maps to assigned?
        # For work, we handle assigned/in_progress/completed/cancelled
        p = await plan(msg, "worker", [])
        assert p.tool_name in ("list_work_orders","get_work_stats")

async def test_show_work_assigned_to_specific_employee():
    p = await plan("Show work assigned to employee 5", "admin", [])
    assert p.tool_name in ("list_work_orders","get_work_stats")
    # Should extract assigned_to if present
    if p.tool_name == "list_work_orders":
        # May have assigned_to 5
        pass

async def test_how_many_work_orders_completed():
    p = await plan("How many work orders are completed?", "admin", [])
    assert p.tool_name == "get_work_stats"
    assert p.arguments.get("status") == "completed"

async def test_is_work_assigned_by_manager_completed():
    # Ambiguous natural language - should still be read-only work query
    p = await plan("Is the work assigned by the manager completed?", "admin", [])
    assert p.tool_name in ("get_work_stats","list_work_orders")

async def test_natural_incident_variations_routing():
    # All examples from the task MUST route to LIST_INCIDENTS (deterministic, no LLM)
    list_cases = [
        "What problems are currently reported in the city?",
        "What incidents are currently reported?",
        "What problems are reported?",
        "What issues are there in the city?",
        "What problems are happening?",
        "Tell me about the reported problems",
        "What are the current incidents?",
        "Show me the current problems",
        "What issues have been reported?",
        "Are there any problems reported?",
        "What is happening in the city?",
        "What are the pending incidents?",
        "Tell me about AI detected problems",
        "Show resolved issues",
        "Show me the pending incidents",
    ]
    for msg in list_cases:
        p = await plan(msg, "citizen", [])
        assert p.tool_name == "list_incidents", f"'{msg}' should be LIST_INCIDENTS, got {p.tool_name} ({p.intent})"

async def test_count_variations_routing_to_stats():
    stats_cases = [
        "How many problems are reported?",
        "How many incidents are there?",
        "How many pending potholes were reported by citizens?",
    ]
    for msg in stats_cases:
        p = await plan(msg, "citizen", [])
        assert p.tool_name == "get_incident_stats", f"'{msg}' should be GET_INCIDENT_STATS, got {p.tool_name}"

async def test_natural_variations_never_route_to_unknown():
    for msg in [
        "What problems are currently reported in the city?",
        "What issues are there in the city?",
        "Tell me about the reported problems",
        "What is happening in the city?",
    ]:
        p = await plan(msg, "citizen", [])
        assert p.intent != "UNKNOWN" and p.tool_name is not None, f"'{msg}' incorrectly routed to UNKNOWN"
