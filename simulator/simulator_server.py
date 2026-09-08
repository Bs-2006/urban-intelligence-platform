"""
Simulator Control Server — separate FastAPI on :5000
Controls simulator/simulator.py sequential image pool without touching backend :8000 / AI :8001
"""
import time
import threading
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
import uvicorn
import re
import uuid
import mimetypes

# Import simulator module (same directory)
import simulator as sim

app = FastAPI(title="Bus Camera Simulator Control", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# State
_started_at: Optional[float] = None
_running: bool = False
_worker_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()
_recent: list[dict] = []
_recent_lock = threading.Lock()
_MAX_RECENT = 30

def _push_recent(entry: dict):
    with _recent_lock:
        _recent.insert(0, entry)
        if len(_recent) > _MAX_RECENT:
            _recent.pop()

def _background_loop():
    print("[SIM_SERVER] Background loop started (interval 3s, trigger 480s)")
    # init positions like run_simulation
    sim.load_routes()
    positions = {b["bus_id"]: 0 for b in sim.SIM_BUSES}
    last_trigger = time.time()
    # ensure pool built
    sim.get_image_pool()
    while not _stop_event.is_set():
        # simulate each bus every 3s
        for bus in sim.SIM_BUSES:
            bus_id = bus["bus_id"]
            route_id = bus["route_id"]
            idx = positions[bus_id]
            obs = sim.simulate_bus(bus_id, route_id, idx)
            # record recent
            img = obs.get("image_path")
            cat = None
            rel = None
            if img:
                try:
                    rel = Path(img).relative_to(sim.ROOT).as_posix() if Path(img).is_absolute() else str(img)
                except:
                    rel = str(img)
                # try to get category
                try:
                    rel2 = Path(img).relative_to(sim.IMAGES_DIR).as_posix()
                    cat = rel2.split("/")[0]
                except:
                    cat = "unknown"
            _push_recent({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "bus_id": bus_id,
                "route_id": route_id,
                "image": rel,
                "category": cat,
                "location": obs.get("location_name"),
            })
            # advance waypoint
            sim.CURRENT_POSITIONS[bus_id] = idx
            scenario_len = len(sim.SCENARIOS.get(route_id, [])) or 5
            positions[bus_id] = (idx + 1) % scenario_len

        # check 8-minute trigger
        if time.time() - last_trigger >= sim.API_TRIGGER_INTERVAL:
            sim.trigger_backend_api()
            last_trigger = time.time()

        # sleep with stop check
        for _ in range(int(sim.SIMULATION_INTERVAL * 10)):
            if _stop_event.is_set():
                break
            time.sleep(0.1)

    print("[SIM_SERVER] Background loop stopped")

@app.get("/health")
def health():
    return {"status": "ok", "service": "simulator", "port": 5000}

@app.get("/images")
def list_images():
    pool = sim.get_image_pool()
    out = []
    for p in pool:
        try:
            rel = p.relative_to(sim.IMAGES_DIR).as_posix()
            cat = rel.split("/")[0]
            full_rel = p.relative_to(sim.ROOT).as_posix()
        except:
            rel = str(p)
            cat = "unknown"
            full_rel = str(p)
        out.append({
            "path": full_rel,
            "rel": rel,
            "category": cat,
            "filename": p.name,
            "size": p.stat().st_size if p.exists() else 0,
        })
    return {"total": len(out), "images": out}

@app.get("/current/image")
def current_image():
    pool = sim.get_image_pool()
    if not pool:
        raise HTTPException(status_code=404, detail="no images in pool")
    info = sim.get_status_info()
    # current is previous index; if none, use next
    rel = info.get("current_rel") or info.get("next_rel")
    if not rel:
        raise HTTPException(status_code=404, detail="no current image")
    # resolve to absolute path
    # rel is like pothole/611.jpg  (relative to IMAGES_DIR)
    p = sim.IMAGES_DIR / rel
    if not p.exists():
        # fallback: search pool for matching rel
        for cand in pool:
            if cand.relative_to(sim.IMAGES_DIR).as_posix() == rel:
                p = cand
                break
    if not p.exists():
        raise HTTPException(status_code=404, detail="image file not found")
    mt, _ = mimetypes.guess_type(str(p))
    return FileResponse(str(p), media_type=mt or "image/jpeg")

@app.get("/current")
def current():
    info = sim.get_status_info()
    return info

@app.get("/status")
def status():
    info = sim.get_status_info()
    with _recent_lock:
        recent_copy = list(_recent[:10])
    # build next info
    return {
        "running": _running,
        "current_image": info.get("current_rel"),
        "current_full": info.get("current_image"),
        "category": info.get("category"),
        "image_index": info.get("image_index"),
        "raw_index": info.get("raw_index"),
        "total_images": info.get("total_images"),
        "next_image": info.get("next_rel"),
        "next_full": info.get("next_image"),
        "next_category": info.get("next_category"),
        "interval_seconds": sim.API_TRIGGER_INTERVAL,
        "buses": sim.SIM_BUSES,
        "recent": recent_copy,
        "started_at": _started_at,
        "uptime_seconds": int(time.time() - _started_at) if _started_at else 0,
    }

@app.post("/start")
def start():
    global _running, _worker_thread, _started_at
    if _running:
        return {"running": True, "message": "already running"}
    _stop_event.clear()
    _running = True
    _started_at = time.time()
    _worker_thread = threading.Thread(target=_background_loop, daemon=True)
    _worker_thread.start()
    return {"running": True, "message": "simulator started", "interval": sim.API_TRIGGER_INTERVAL}

@app.post("/stop")
def stop():
    global _running, _started_at
    if not _running:
        return {"running": False, "message": "already stopped"}
    _stop_event.set()
    _running = False
    _started_at = None
    return {"running": False, "message": "simulator stopped"}

ALLOWED_UPLOAD_CATEGORIES = {"pothole", "damaged_road", "waterlogging"}
ALLOWED_UPLOAD_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def _sanitize_filename(name: str) -> str:
    base = Path(name).name.strip()
    # remove hidden prefix, keep only safe chars
    base = base.lstrip(".")
    # replace unsafe chars
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    if not base or base in {".", ".."}:
        base = "image.jpg"
    return base

@app.post("/upload-image")
async def upload_image(category: str = Form(...), file: UploadFile = File(...)):
    cat = (category or "").strip().lower()
    if cat not in ALLOWED_UPLOAD_CATEGORIES:
        raise HTTPException(status_code=400, detail="category must be one of: pothole, damaged_road, waterlogging")
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="file is required")
    orig = _sanitize_filename(file.filename)
    if orig.startswith("."):
        raise HTTPException(status_code=400, detail="hidden files not allowed")
    ext = Path(orig).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTS:
        raise HTTPException(status_code=400, detail=f"unsupported extension '{ext}'. Allowed: .jpg, .jpeg, .png, .webp")
    content = await file.read()
    if not content or len(content) == 0:
        raise HTTPException(status_code=400, detail="zero-byte file not allowed")
    # validate image content via Pillow
    try:
        from PIL import Image as PILImage
        import io
        im = PILImage.open(io.BytesIO(content))
        im.verify()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"invalid image file: {e}")
    # ensure directory exists
    dest_dir = sim.IMAGES_DIR / cat
    dest_dir.mkdir(parents=True, exist_ok=True)
    # generate unique safe filename
    stem = Path(orig).stem
    # sanitize stem again
    stem = re.sub(r"[^a-zA-Z0-9_-]", "_", stem)[:40] or "image"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # avoid overwrite: if file exists, add uuid suffix
    candidate = f"uploaded_{cat}_{timestamp}{ext}"
    # also include original stem hint if not generic?
    # use candidate, if exists add uuid
    dest = dest_dir / candidate
    if dest.exists():
        candidate = f"uploaded_{cat}_{timestamp}_{uuid.uuid4().hex[:6]}{ext}"
        dest = dest_dir / candidate
    # also if original stem is meaningful, try to keep hint but ensure uniqueness
    # we keep candidate as above per spec example
    try:
        dest.write_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to save file: {e}")
    # refresh pool without resetting index
    try:
        new_pool = sim._build_image_pool()
        # preserve current index modulo new length
        with sim._get_pool_lock():
            old_idx = sim._IMAGE_INDEX
            sim._IMAGE_POOL = new_pool
            # keep index within bounds (wrap)
            if new_pool:
                sim._IMAGE_INDEX = old_idx % len(new_pool)
            else:
                sim._IMAGE_INDEX = 0
    except Exception as e:
        print(f"[UPLOAD] pool refresh failed: {e}")
    # counts
    pool = sim.get_image_pool()
    total = len(pool)
    cat_count = sum(1 for p in pool if p.relative_to(sim.IMAGES_DIR).parts[0] == cat) if pool else 0
    rel = f"{cat}/{candidate}"
    full_rel = f"images/{rel}"
    return {
        "success": True,
        "filename": candidate,
        "category": cat,
        "path": rel,
        "full_path": full_rel,
        "total_images": total,
        "category_count": cat_count,
    }

@app.post("/trigger")
@app.post("/next")
def trigger():
    """
    Manual trigger: advance sequential pool, create raw observation for each bus, POST to backend.
    Does NOT call AI directly — goes through RAW pipeline only.
    """
    # Ensure at least one simulate cycle if no recent
    # Create observation for each bus using next sequential image
    results = []
    for bus in sim.SIM_BUSES:
        bus_id = bus["bus_id"]
        route_id = bus["route_id"]
        # Use current waypoint for location (round-robin)
        # For demo, use the bus's current position
        pos = sim.CURRENT_POSITIONS.get(bus_id, 0)
        # simulate_bus will consume next sequential image
        obs = sim.simulate_bus(bus_id, route_id, pos)
        # advance waypoint for next time
        sim.CURRENT_POSITIONS[bus_id] = (pos + 1) % (len(sim.SCENARIOS.get(route_id, [])) or 5)
        # record recent
        img = obs.get("image_path")
        cat = "unknown"
        rel = str(img) if img else None
        if img:
            try:
                p = Path(img)
                rel2 = p.relative_to(sim.IMAGES_DIR).as_posix() if p.is_absolute() or (sim.IMAGES_DIR in p.parents) else None
                # fallback: try to derive from pool info
                info = sim.get_status_info()
                # image just consumed is previous current
                cat = info.get("category") or "unknown"
            except:
                pass
            try:
                cat = Path(img).relative_to(sim.IMAGES_DIR).parts[0]
            except:
                # sequential image path is absolute, category is folder name
                try:
                    cat = Path(img).parent.name
                except:
                    cat = "unknown"
            try:
                rel_disp = Path(img).relative_to(sim.IMAGES_DIR).as_posix()
            except:
                rel_disp = Path(img).name
            _push_recent({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "bus_id": bus_id,
                "route_id": route_id,
                "image": rel_disp,
                "category": cat,
                "location": obs.get("location_name"),
                "triggered": True,
            })
        # send to backend
        ok = sim.send_camera_observation(obs)
        results.append({
            "bus_id": bus_id,
            "route_id": route_id,
            "image": str(img) if img else None,
            "category": cat,
            "sent": ok,
            "observation": {k: str(v) if isinstance(v, Path) else v for k, v in obs.items()},
        })
        # advance waypoint already done
    info = sim.get_status_info()
    return {
        "triggered": True,
        "results": results,
        "current_image": info.get("current_rel"),
        "category": info.get("category"),
        "next_image": info.get("next_rel"),
        "next_category": info.get("next_category"),
        "total_images": info.get("total_images"),
        "image_index": info.get("image_index"),
    }

HTML_PAGE = r"""
<!doctype html>
<html>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bus Camera Simulator — Control</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;padding:20px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:12px}
h1{font-size:20px} .badge{display:inline-block;background:#0f172a;color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;letter-spacing:1px}
.btn{padding:8px 14px;border-radius:10px;border:1px solid #0f172a;cursor:pointer;font-weight:700;font-size:12px}
.btn.primary{background:#0f172a;color:#fff} .btn.warn{background:#fff;color:#0f172a} .btn.accent{background:#16a34a;color:#fff;border-color:#16a34a}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.k{font-size:10px;font-weight:700;color:#64748b;letter-spacing:.5px} .v{font-weight:700;margin-top:2px}
pre{font-size:11px;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
</style>
</head>
<body>
<div style="max-width:900px;margin:0 auto">
<div class="card" style="text-align:center">
<div class="badge">SIMULATOR SERVER :5000</div>
<h1 style="margin-top:8px">BUS CAMERA SIMULATOR</h1>
<p style="color:#64748b;font-size:12px;margin-top:4px">Sequential cycling: pothole → damaged_road → waterlogging &nbsp;|&nbsp; Interval 8 min (480s) &nbsp;|&nbsp; RAW → Backend :8000 → AI :8001</p>
</div>

<div class="card">
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button class="btn primary" onclick="api('/start','POST')">START</button>
<button class="btn warn" onclick="api('/stop','POST')">STOP</button>
<button class="btn accent" onclick="api('/trigger','POST')">TRIGGER NEXT OBSERVATION</button>
<button class="btn" onclick="refresh()">REFRESH STATUS</button>
</div>
<div id="status" style="margin-top:12px"></div>
</div>

<div class="card">
<div style="font-weight:800;font-size:13px;letter-spacing:.5px">UPLOAD CAMERA IMAGE</div>
<p style="font-size:11px;color:#64748b;margin-top:4px">Adds image to <code>simulator/images/{pothole|damaged_road|waterlogging}</code> and refreshes pool immediately — no restart, no incident.</p>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-top:10px">
<div>
<div class="k">CATEGORY</div>
<select id="upCat" style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:10px;font-size:12px;margin-top:4px">
<option value="pothole">Pothole</option>
<option value="damaged_road">Damaged Road</option>
<option value="waterlogging">Waterlogging</option>
</select>
</div>
<div>
<div class="k">IMAGE</div>
<input id="upFile" type="file" accept=".jpg,.jpeg,.png,.webp" style="margin-top:4px;font-size:12px">
</div>
<button class="btn primary" onclick="doUpload()" style="height:36px">UPLOAD IMAGE</button>
</div>
<div id="upMsg" style="margin-top:10px;font-size:12px"></div>
</div>

<div class="card">
<div class="k">CURRENT CAMERA FRAME</div>
<img id="curFrame" src="/current/image" style="width:100%;max-height:360px;object-fit:contain;background:#0f172a;border-radius:10px;margin-top:8px" onerror="this.style.display='none'" onload="this.style.display='block'">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px">
<div><div class="k">CATEGORY</div><div id="curCat" class="v">—</div></div>
<div><div class="k">FILENAME</div><div id="curFile" class="v" style="font-size:11px;word-break:break-all">—</div></div>
<div><div class="k">PROGRESS</div><div id="curProg" class="v">—</div></div>
<div><div class="k">NEXT</div><div id="curNext" class="v" style="font-size:11px;word-break:break-all">—</div></div>
</div>
</div>

<div class="grid">
<div class="card"><div class="k">IMAGES</div><div id="images"></div></div>
<div class="card"><div class="k">RECENT OBSERVATIONS</div><div id="recent"></div></div>
</div>

<div class="card"><div class="k">RAW STATUS JSON</div><pre id="raw"></pre></div>
</div>
<script>
async function doUpload(){
  const cat = document.getElementById('upCat').value;
  const fileInput = document.getElementById('upFile');
  const msg = document.getElementById('upMsg');
  const f = fileInput.files[0];
  if(!f){ msg.innerHTML='<span style="color:#dc2626">Choose a file first</span>'; return; }
  const fd = new FormData();
  fd.append('category', cat);
  fd.append('file', f);
  msg.textContent='Uploading...';
  try{
    const r = await fetch('/upload-image', {method:'POST', body: fd});
    const j = await r.json();
    if(!r.ok) throw new Error(j.detail || JSON.stringify(j));
    msg.innerHTML = `<span style="color:#16a34a">✓ Image uploaded successfully</span><br>Category: <b>${j.category}</b> &nbsp; File: <b>${j.filename}</b><br>Image pool: <b>${j.total_images}</b> &nbsp; (${j.category} : ${j.category_count})`;
    fileInput.value='';
    refresh();
  }catch(e){
    msg.innerHTML = `<span style="color:#dc2626">Upload failed: ${e.message}</span>`;
  }
}
async function api(path, method='GET'){
  const r = await fetch(path, {method});
  const j = await r.json();
  // after trigger/start/stop, refresh
  refresh();
  return j;
}
async function refresh(){
  const s = await (await fetch('/status')).json();
  // update current frame image (cache-bust)
  const imgEl = document.getElementById('curFrame');
  if(imgEl){ imgEl.src = '/current/image?t=' + Date.now(); }
  const catEl = document.getElementById('curCat'); if(catEl) catEl.textContent = (s.category||'—').toUpperCase();
  const fileEl = document.getElementById('curFile'); if(fileEl) fileEl.textContent = s.current_image||'—';
  const progEl = document.getElementById('curProg'); if(progEl) progEl.textContent = `${s.image_index||0} / ${s.total_images||0}`;
  const nextEl = document.getElementById('curNext'); if(nextEl) nextEl.textContent = s.next_image||'—';
  const st = document.getElementById('status');
  st.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px">
      <div><div class="k">STATUS</div><div class="v" style="color:${s.running?'#16a34a':'#64748b'}">${s.running?'RUNNING':'STOPPED'}</div></div>
      <div><div class="k">CURRENT IMAGE</div><div class="v">${s.current_image||'—'}</div><div style="font-size:11px;color:#64748b">${s.category||''}</div></div>
      <div><div class="k">NEXT IMAGE</div><div class="v">${s.next_image||'—'}</div><div style="font-size:11px;color:#64748b">${s.next_category||''}</div></div>
      <div><div class="k">PROGRESS</div><div class="v">${s.image_index||0} / ${s.total_images||0}</div></div>
      <div><div class="k">INTERVAL</div><div class="v">${s.interval_seconds}s (8 min)</div></div>
      <div><div class="k">UPTIME</div><div class="v">${s.uptime_seconds||0}s</div></div>
    </div>
    <div style="font-size:11px;color:#64748b;margin-top:8px">Buses: ${s.buses.map(b=>b.bus_id+'→'+b.route_id).join(', ')}</div>
  `;
  document.getElementById('raw').textContent = JSON.stringify(s, null, 2);
  const img = await (await fetch('/images')).json();
  document.getElementById('images').innerHTML = `<div style="font-size:11px;color:#64748b">Total ${img.total} — ${img.images.filter(i=>i.category==='pothole').length} pothole · ${img.images.filter(i=>i.category==='damaged_road').length} damaged_road · ${img.images.filter(i=>i.category==='waterlogging').length} waterlogging</div>
    <div style="max-height:160px;overflow:auto;margin-top:6px;font-size:11px">${img.images.slice(0,12).map(i=>`<div>${i.rel}</div>`).join('')}${img.total>12?'<div>…</div>':''}</div>`;
  document.getElementById('recent').innerHTML = s.recent.length? `<table><tr><th>Time</th><th>Bus</th><th>Category</th><th>Image</th></tr>${s.recent.map(r=>`<tr><td>${new Date(r.timestamp).toLocaleTimeString()}</td><td>${r.bus_id}</td><td>${r.category}</td><td>${r.image||''}</td></tr>`).join('')}</table>` : '<div style="font-size:11px;color:#94a3b8">No observations yet — click TRIGGER</div>';
}
refresh(); setInterval(refresh, 3000);
</script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
def ui():
    return HTML_PAGE

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
