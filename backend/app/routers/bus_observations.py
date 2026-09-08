from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
from pathlib import Path
import mimetypes
from app.dependencies import get_db
from app.models.bus_observation import BusObservation
from app.services.supabase_storage import upload_incident_image
from app.config import get_settings

router = APIRouter(prefix="/api/bus-observations", tags=["Bus Observations"])

# Local dev media root: backend/local_media/bus_observations
LOCAL_MEDIA_ROOT = Path(__file__).resolve().parents[2] / "local_media" / "bus_observations"
LOCAL_MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

# Legacy simulator cache location (for AI worker compatibility)
SIMULATOR_CACHE_ROOT = Path(__file__).resolve().parents[3] / "simulator" / "images_cache"

def _safe_filename(name: str) -> str:
    # strip path separators, keep only basename
    return Path(name).name.replace("..", "_")

def _resolve_observation_file(obs: BusObservation) -> Path | None:
    """Resolve local file for an observation without exposing arbitrary paths."""
    if not obs or not obs.image_path:
        return None
    # obs.image_path is expected to be like "images_cache/12_foo.jpg" or absolute-ish
    # Try LOCAL_MEDIA_ROOT first (new primary)
    fname = _safe_filename(obs.image_path)
    # obs.image_path may contain subdir; we stored as f"{id}_{filename}" in both locs
    # Search by exact filename in LOCAL_MEDIA_ROOT
    # 1) LOCAL_MEDIA_ROOT / fname
    p = LOCAL_MEDIA_ROOT / fname
    if p.exists() and p.is_file():
        return p
    # 2) LOCAL_MEDIA_ROOT / obs.image_path basename with id prefix already
    # 3) SIMULATOR_CACHE_ROOT / fname
    p2 = SIMULATOR_CACHE_ROOT / fname
    if p2.exists() and p2.is_file():
        return p2
    # 4) legacy path: simulator/images/... (image_path like "images/road-damages/xxx.jpg")
    # Try resolving relative to simulator root
    sim_root = Path(__file__).resolve().parents[3] / "simulator"
    p3 = sim_root / obs.image_path.lstrip("/")
    if p3.exists() and p3.is_file():
        return p3
    # 5) absolute path if image_path was absolute
    try:
        p4 = Path(obs.image_path)
        if p4.is_absolute() and p4.exists() and p4.is_file():
            # ensure it's inside allowed roots (prevent traversal abuse)
            # only allow if inside LOCAL_MEDIA_ROOT, SIMULATOR_CACHE_ROOT, or sim_root
            for allowed in [LOCAL_MEDIA_ROOT, SIMULATOR_CACHE_ROOT, sim_root]:
                try:
                    p4.relative_to(allowed)
                    return p4
                except ValueError:
                    continue
            # if not inside allowed, don't serve
            return None
    except Exception:
        pass
    return None

# Allow both /api/bus-observations and /api/bus-observations/ via implicit handling

@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_observation(
    bus_id: str = Form(...),
    route_id: Optional[str] = Form(None),
    latitude: str = Form(...),
    longitude: str = Form(...),
    location_name: Optional[str] = Form(None),
    occurred_at: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    # Simulator sends field named "image"; AI worker fallback uses "file" – accept either
    upload = image or file
    try:
        lat = float(latitude)
        lng = float(longitude)
    except:
        raise HTTPException(status_code=400, detail="Invalid latitude/longitude")
    # parse occurred_at if provided
    occurred = None
    if occurred_at:
        try:
            occurred = datetime.fromisoformat(occurred_at.replace("Z","+00:00"))
        except:
            occurred = None
    # Create observation row first to get ID
    obs = BusObservation(
        bus_id=bus_id,
        route_id=route_id,
        latitude=lat,
        longitude=lng,
        location_name=location_name,
        occurred_at=occurred,
    )
    db.add(obs)
    await db.commit()
    await db.refresh(obs)

    image_key = None
    image_url = None
    image_path = None
    local_saved_path = None
    if upload and upload.filename:
        try:
            content = await upload.read()
            if content:
                # Validate size/type via supabase helper (preserves image_key for future Supabase)
                image_key = await upload_incident_image(content, upload.filename, obs.id, upload.content_type or "image/jpeg")
                from app.services.supabase_storage import get_public_url
                image_url = get_public_url(image_key)
                # Persist original bytes locally for dev/SIH prototype (no Supabase required)
                try:
                    safe_name = f"{obs.id}_{_safe_filename(upload.filename)}"
                    # Primary: backend/local_media/bus_observations (served via GET /api/bus-observations/{id}/image)
                    local_saved_path = LOCAL_MEDIA_ROOT / safe_name
                    local_saved_path.write_bytes(content)
                    # Secondary: simulator/images_cache for AI worker compatibility (observation_worker checks this)
                    try:
                        SIMULATOR_CACHE_ROOT.mkdir(parents=True, exist_ok=True)
                        (SIMULATOR_CACHE_ROOT / safe_name).write_bytes(content)
                    except Exception as e3:
                        print(f"[bus-observations] simulator cache save skipped: {e3}")
                    image_path = f"images_cache/{safe_name}"  # relative, worker's possible_local resolves
                except Exception as e2:
                    print(f"[bus-observations] local save failed: {e2}")
                    image_path = image_key
                # update row: preserve image_key for Supabase, image_path stays local for AI worker
                obs.image_key = image_key
                obs.image_url = image_url
                obs.image_path = image_path or image_key
                await db.commit()
                await db.refresh(obs)
        except HTTPException:
            raise
        except Exception as e:
            # don't fail observation if image upload fails – log
            print(f"[bus-observations] image upload failed: {e}")

    local_image_url = f"/api/bus-observations/{obs.id}/image" if obs.image_path else None
    return {
        "id": str(obs.id),
        "bus_id": obs.bus_id,
        "route_id": obs.route_id,
        "latitude": obs.latitude,
        "longitude": obs.longitude,
        "location_name": obs.location_name,
        "occurred_at": obs.occurred_at.isoformat() if obs.occurred_at else occurred_at,
        "image_path": obs.image_path or image_path,
        "image_key": obs.image_key,
        "image_url": obs.image_url,
        "local_image_url": local_image_url,
        "image_saved": bool(obs.image_path),
        "image_size": len(content) if upload and 'content' in locals() else None,
        "image_filename": upload.filename if upload else None,
        "created_at": obs.created_at.isoformat() if obs.created_at else None,
    }

@router.get("/{obs_id}/image")
async def get_observation_image(obs_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BusObservation).where(BusObservation.id == obs_id))
    obs = result.scalar_one_or_none()
    if not obs or not obs.image_path:
        raise HTTPException(status_code=404, detail="Image not found for observation")
    fpath = _resolve_observation_file(obs)
    if not fpath or not fpath.exists():
        raise HTTPException(status_code=404, detail="Image file not found on server")
    media_type, _ = mimetypes.guess_type(str(fpath))
    return FileResponse(str(fpath), media_type=media_type or "application/octet-stream", filename=fpath.name)


@router.get("")
@router.get("/")
async def list_observations(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BusObservation).order_by(BusObservation.created_at.desc()).offset(skip).limit(limit))
    rows = result.scalars().all()
    # Fetch associated incident types via metadata_json->>'observation_id' (keep compatible)
    ids = [str(r.id) for r in rows]
    id_set = set(ids)
    incident_map: dict[str, str] = {}
    if ids:
        try:
            from app.models.incident import Incident
            # Fetch recent ai incidents and map in python to avoid JSON operator incompatibilities
            res2 = await db.execute(select(Incident).order_by(Incident.created_at.desc()).limit(300))
            for inc in res2.scalars().all():
                m = inc.metadata_json or {}
                oid = str(m.get("observation_id") or "")
                if oid and oid in id_set and oid not in incident_map:
                    incident_map[oid] = inc.incident_type.value if hasattr(inc.incident_type, "value") else str(inc.incident_type)
        except Exception as e:
            print(f"[bus-observations] incident_map query failed: {e}")
        # Fallback: also check AI worker SQLite observation_analysis for observations not yet in incidents table (e.g., processing lag)
        try:
            import sqlite3
            ai_db = Path(__file__).resolve().parents[3] / "pothole-ai" / "ai" / "ai_observations.db"
            if ai_db.exists():
                con = sqlite3.connect(str(ai_db))
                con.row_factory = sqlite3.Row
                cur = con.cursor()
                # Map incident_type values: potholes->pothole, road_damage stays, waterlogging stays
                type_map = {"potholes": "pothole", "pothole": "pothole", "road_damage": "damaged_road", "damaged_road": "damaged_road", "waterlogging": "waterlogging"}
                for oid in id_set:
                    if oid in incident_map:
                        continue
                    cur.execute("SELECT incident_type, detected, observation_status, status FROM observation_analysis WHERE observation_id=?", (oid,))
                    row = cur.fetchone()
                    if row and row["detected"] == 1 and row["incident_type"]:
                        raw = row["incident_type"]
                        incident_map[oid] = type_map.get(raw, raw)
                con.close()
        except Exception as e:
            print(f"[bus-observations] ai_db fallback failed: {e}")
    out=[]
    for r in rows:
        oid = str(r.id)
        ai_type = incident_map.get(oid)
        out.append({
            "id": oid,
            "bus_id": r.bus_id,
            "route_id": r.route_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "location_name": r.location_name,
            "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
            "image_path": r.image_path,
            "image_url": r.image_url,
            "image_key": r.image_key,
            "local_image_url": f"/api/bus-observations/{r.id}/image" if r.image_path else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            # New: real AI road incident category, compatible additive field
            "ai_incident_type": ai_type,
            "incident_type": ai_type,
            "category": ai_type,  # alias for frontend convenience
        })
    return out
