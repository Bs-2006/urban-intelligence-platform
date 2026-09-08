import httpx
from app.agent.tools.registry import register

BASE = "http://127.0.0.1:8000"

async def list_incidents(args: dict, ctx):
    params = {k: v for k, v in args.items() if v is not None}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/incidents/", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        data = r.json()
        return {"success": True, "data": {"incidents": data, "count": len(data)}}

async def get_incident(args: dict, ctx):
    iid = args.get("incident_id") or args.get("id")
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/incidents/{iid}", headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        return {"success": True, "data": r.json()}

async def get_incident_stats(args: dict, ctx):
    params = {k: v for k, v in args.items() if v is not None}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/incidents/stats", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        return {"success": True, "data": r.json()}

register("list_incidents", list_incidents, "List incidents with filters")
register("get_incident", get_incident, "Get incident by id")
register("get_incident_stats", get_incident_stats, "Get incident stats aggregated by status/source/type/severity")
