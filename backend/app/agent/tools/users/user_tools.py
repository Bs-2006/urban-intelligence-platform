import httpx
from app.agent.tools.registry import register

BASE = "http://127.0.0.1:8000"

async def get_me(args: dict, ctx):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/users/me", headers={"Authorization": f"Bearer {ctx.token}"})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        return {"success": True, "data": r.json()}

async def list_users(args: dict, ctx):
    params = {k: v for k, v in args.items() if v is not None}
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/users/", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        data = r.json()
        return {"success": True, "data": {"users": data, "count": len(data)}}

async def list_employees(args: dict, ctx):
    params = {}
    if "role" in args:
        params["role"] = args["role"]
    else:
        params["role"] = "worker"
    if "skip" in args:
        params["skip"] = args["skip"]
    if "limit" in args:
        params["limit"] = args["limit"]
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/users/", params=params, headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        data = r.json()
        return {"success": True, "data": {"employees": data, "count": len(data)}}

async def get_users_stats(args: dict, ctx):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BASE}/users/stats", headers={"Authorization": f"Bearer {ctx.token}"} if ctx.token else {})
        if r.status_code >= 400:
            return {"success": False, "error": r.text, "status_code": r.status_code}
        return {"success": True, "data": r.json()}

register("get_me", get_me, "Get own profile")
register("list_users", list_users, "List users with optional role filter")
register("list_employees", list_employees, "List employees with role=worker")
register("list_workers", list_employees, "List workers with role=worker (alias for list_employees)")
register("get_users_stats", get_users_stats, "Get user stats aggregated by role")
