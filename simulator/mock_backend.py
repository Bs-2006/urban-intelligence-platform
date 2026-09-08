"""
Mock backend for simulator integration testing.
- Legacy: POST /api/incidents (incident pipeline)
- New: POST /api/bus-observations (raw camera pipeline) - multipart/form-data, no AI
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, Any
import sqlite3
import uuid
import shutil
from datetime import datetime, timezone
from pathlib import Path
import json

DB_PATH = Path(__file__).parent / "incidents.db"
UPLOAD_DIR = Path(__file__).parent / "uploads" / "bus_observations"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Bhimavaram Mock Backend")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    # Legacy incidents table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        incident_type TEXT NOT NULL,
        title TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        description TEXT,
        severity TEXT,
        status TEXT,
        location_name TEXT,
        address TEXT,
        bus_id TEXT,
        route_id TEXT,
        created_by TEXT,
        speed_kmh REAL,
        vehicle_count INTEGER,
        congestion_level TEXT,
        occurred_at TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    # New raw observations table - no AI fields
    cur.execute("""
    CREATE TABLE IF NOT EXISTS bus_observations (
        id TEXT PRIMARY KEY,
        bus_id TEXT NOT NULL,
        route_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        location_name TEXT,
        occurred_at TEXT NOT NULL,
        image_filename TEXT,
        image_path TEXT,
        created_at TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

init_db()

# Serve uploads
UPLOADS_PARENT = Path(__file__).parent / "uploads"
UPLOADS_PARENT.mkdir(exist_ok=True)
try:
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_PARENT)), name="uploads")
except Exception as e:
    print(f"[WARN] Could not mount /uploads: {e}")

class IncidentCreate(BaseModel):
    incident_type: str
    title: str
    latitude: float
    longitude: float
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    location_name: Optional[str] = None
    address: Optional[str] = None
    bus_id: Optional[str] = None
    route_id: Optional[str] = None
    created_by: Optional[str] = None
    speed_kmh: Optional[float] = None
    vehicle_count: Optional[int] = None
    congestion_level: Optional[str] = None
    occurred_at: Optional[str] = None
    metadata_json: Optional[Any] = None

@app.post("/api/incidents", status_code=201)
def create_incident(payload: IncidentCreate):
    incident_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    metadata_str = json.dumps(payload.metadata_json) if payload.metadata_json is not None else None
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO incidents (id, incident_type, title, latitude, longitude, description, severity, status, location_name, address, bus_id, route_id, created_by, speed_kmh, vehicle_count, congestion_level, occurred_at, metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        incident_id, payload.incident_type, payload.title, payload.latitude, payload.longitude,
        payload.description, payload.severity, payload.status, payload.location_name, payload.address,
        payload.bus_id, payload.route_id, payload.created_by, payload.speed_kmh, payload.vehicle_count,
        payload.congestion_level, payload.occurred_at, metadata_str, now, now
    ))
    conn.commit()
    cur.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()
    result = dict(row)
    if result["metadata_json"]:
        try: result["metadata_json"] = json.loads(result["metadata_json"])
        except: pass
    return result

@app.get("/api/incidents")
def list_incidents():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        if d["metadata_json"]:
            try: d["metadata_json"] = json.loads(d["metadata_json"])
            except: pass
        out.append(d)
    return out

# --- RAW OBSERVATION ENDPOINT (new pipeline) ---
@app.post("/api/bus-observations", status_code=201)
async def create_bus_observation(
    bus_id: str = Form(...),
    route_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    location_name: str = Form(...),
    occurred_at: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Receives raw camera observation: no AI, no incident_type.
    Saves actual binary image to uploads/bus_observations/, verifies it, stores metadata.
    """
    obs_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Read actual uploaded bytes
    try:
        contents = await image.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read uploaded image: {e}")
    finally:
        try:
            await image.close()
        except:
            pass

    if not contents or len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    # Validate bytes: images via Pillow, videos via basic header check
    ext = Path(image.filename or "").suffix.lower()
    is_video = ext in {".mp4", ".mov", ".avi", ".mkv", ".webm"}
    if not is_video:
        try:
            from PIL import Image as PILImage
            import io
            im = PILImage.open(io.BytesIO(contents))
            im.verify()
            im2 = PILImage.open(io.BytesIO(contents))
            w, h = im2.size
            if w == 0 or h == 0:
                raise ValueError("Invalid dimensions")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Uploaded file is not a valid image: {e}")
    else:
        # video: ensure non-empty and minimum size threshold (1KB)
        if len(contents) < 1024:
            raise HTTPException(status_code=400, detail="Uploaded video is too small / empty")

    safe_name = f"{obs_id}_{Path(image.filename).name}"
    dest_path = UPLOAD_DIR / safe_name
    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        with dest_path.open("wb") as buffer:
            buffer.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")

    # Verify saved file
    if not dest_path.exists():
        raise HTTPException(status_code=500, detail="Failed to save media: file not created")
    saved_size = dest_path.stat().st_size
    if saved_size == 0:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Saved media is empty")
    # re-validate saved file for images only
    saved_ext = dest_path.suffix.lower()
    if saved_ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
        try:
            from PIL import Image as PILCheck
            with PILCheck.open(dest_path) as im_check:
                im_check.verify()
            with PILCheck.open(dest_path) as im_check2:
                _w, _h = im_check2.size
        except Exception as e:
            dest_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Saved file is not a valid image: {e}")

    rel_path = dest_path.relative_to(Path(__file__).parent).as_posix()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO bus_observations (id, bus_id, route_id, latitude, longitude, location_name, occurred_at, image_filename, image_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        obs_id, bus_id, route_id, latitude, longitude, location_name, occurred_at,
        image.filename, rel_path, created_at
    ))
    conn.commit()
    cur.execute("SELECT * FROM bus_observations WHERE id = ?", (obs_id,))
    row = cur.fetchone()
    conn.close()
    result = dict(row)
    result["image_saved"] = True
    result["image_size"] = saved_size
    result["image_filename"] = image.filename
    result["image_path"] = rel_path
    result["image_url"] = f"/{rel_path}"
    # also verify fields
    result["message"] = "Raw observation stored, awaiting AI analysis"
    return result

@app.get("/api/bus-observations")
def list_bus_observations():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bus_observations ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["image_url"] = f"/{d['image_path']}" if d.get("image_path") else None
        out.append(d)
    return out

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Bhimavaram Mock Backend running", "endpoints": ["/api/incidents", "/api/bus-observations"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
