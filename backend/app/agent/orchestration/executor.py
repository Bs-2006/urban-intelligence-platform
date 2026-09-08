from app.agent.policies.permission import check_permission
from app.agent.policies.validation import validate
from app.agent.tools.registry import get_tool
from app.agent.errors.agent_errors import ToolExecutionError, ToolNotFoundError

async def execute(tool_name: str, args: dict, context):
    check_permission(tool_name, context.role)
    validate(tool_name, args)
    tool = get_tool(tool_name)
    if not tool:
        raise ToolNotFoundError(f"Tool {tool_name} not found")
    result = await tool["func"](args, context)
    if not result.get("success"):
        raise ToolExecutionError(result.get("error", "Tool failed"), status_code=result.get("status_code"))
    return result
