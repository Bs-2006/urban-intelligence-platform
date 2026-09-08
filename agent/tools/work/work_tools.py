import httpx
from app.agent.tools.registry import register

BASE = "http://127.0.0.1:8000"

async def list_work_orders(args: dict, ctx):
    params = {k: v for k, v in args.items() if v is not None}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/work/", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        data = r.json()
        return {"success": True, "data": {"work_orders": data, "count": len(data)}}

async def get_work_stats(args: dict, ctx):
    params = {k: v for k, v in args.items() if v is not None}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/work/stats", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        return {"success": True, "data": r.json()}

register("list_work_orders", list_work_orders, "List work orders")
register("get_work_stats", get_work_stats, "Get work stats aggregated by status/assignee")
