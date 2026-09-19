from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import init_db
from app.routers import auth, users, work, buses, routes, bus_stands, incidents, public, bus_observations, ai_incidents, vehicle_security
try:
    from app.agent.router import router as agent_router
    _has_agent = True
except Exception as _e:
    _has_agent = False
    agent_router = None  # type: ignore
import app.models.bus_observation  # noqa: ensure table registered for create_all
import app.models.vehicle_security  # noqa
import app.models.work_evidence  # noqa

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await init_db()


app.include_router(bus_observations.router)
app.include_router(ai_incidents.router)
app.include_router(public.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(work.router)
app.include_router(buses.router)
app.include_router(routes.router)
app.include_router(bus_stands.router)
app.include_router(incidents.router)
app.include_router(vehicle_security.router)
# --- Agent (read-only, fail-safe: never break existing app if agent fails) ---
if _has_agent and agent_router is not None:
    try:
        app.include_router(agent_router)
    except Exception:
        pass


@app.get("/health")
async def health():
    return {"status": "ok"}

