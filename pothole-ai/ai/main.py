"""
FastAPI AI service – Multi-defect Urban Intelligence (8001).
Preserves pothole detector, adds road_damage, garbage, traffic via multi_detector.
"""
import os
import time
import base64
import tempfile
import json as jsonlib
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

try:
    from pothole_detector import detect_image, get_model, CONFIDENCE_THRESHOLD, HF_MODEL_ID
    from video_processor import process_video, FRAME_SKIP
    from incident_client import build_incident_payload, send_incident
    from multi_detector import detect_image_multi
    from video_processor import process_video_multi
except ImportError:
    from ai.pothole_detector import detect_image, get_model, CONFIDENCE_THRESHOLD, HF_MODEL_ID
    from ai.video_processor import process_video, FRAME_SKIP, process_video_multi
    from ai.incident_client import build_incident_payload, send_incident
    from ai.multi_detector import detect_image_multi

app = FastAPI(title="Urban Intelligence AI - 8001")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANNOTATED_DIR = Path(tempfile.gettempdir()) / "pothole_ai_annotated"
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)
try:
    app.mount("/annotated", StaticFiles(directory=str(ANNOTATED_DIR)), name="annotated")
except:
    pass
# Demo data dir (isolated synthetic)
DEMO_ANPR_DIR = Path(__file__).parent.parent / "demo_data" / "anpr"
try:
    if DEMO_ANPR_DIR.exists():
        app.mount("/demo-data/anpr", StaticFiles(directory=str(DEMO_ANPR_DIR)), name="demo-anpr")
except:
    pass

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

# helper for video sampling: 1 frame per interval_sec (default 3s) using OpenCV
def _sample_video_frames(video_path: str, interval_sec: float = 3.0):
    import cv2
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total_frames / fps if fps else 0
    frames = []
    idx = 0
    sampled = 0
    # interval in frames
    interval_frames = max(1, int(round(fps * interval_sec))) if fps else int(30*interval_sec)
    tmpdir = Path(tempfile.gettempdir()) / "pothole_ai_video_frames"
    tmpdir.mkdir(parents=True, exist_ok=True)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % interval_frames == 0:
            ts = idx / fps if fps else 0
            fp = str(tmpdir / f"sample_{idx}_{int(time.time()*1000)}.jpg")
            cv2.imwrite(fp, frame)
            frames.append({"frame_number": idx, "timestamp": round(ts,2), "path": fp})
            sampled += 1
        idx += 1
    cap.release()
    return {"frames": frames, "fps": fps, "total_frames": total_frames, "duration": round(duration,2), "sampled": sampled, "interval_sec": interval_sec}


@app.on_event("startup")
async def startup():
    try:
        get_model()
        print("[STARTUP] Pothole model loaded")
    except Exception as e:
        print(f"[STARTUP] Pothole model load failed (will retry on request): {e}")
    # Lazy load other enabled models in background (non-blocking, log only)
    try:
        from multi_detector import get_model as get_m
        import threading
        def _preload():
            for k in ["road_damage"]:
                try:
                    m = get_m(k)
                    if m:
                        print(f"[STARTUP] Preloaded {k}")
                except Exception as e:
                    print(f"[STARTUP] Preload {k} failed: {e}")
        threading.Thread(target=_preload, daemon=True).start()
    except Exception as e:
        print(f"[STARTUP] Preload thread failed: {e}")
    try:
        try:
            from observation_worker import start_background_worker
        except ImportError:
            from ai.observation_worker import start_background_worker
        start_background_worker()
        print("[STARTUP] Observation worker started")
    except Exception as e:
        print(f"[STARTUP] Worker failed: {e}")


@app.get("/health")
def health():
    return {"status": "ok", "model": HF_MODEL_ID, "threshold": CONFIDENCE_THRESHOLD}

@app.get("/api/models")
def models():
    try:
        from model_registry import list_models
    except ImportError:
        from ai.model_registry import list_models
    return list_models()

# Helper to parse coords and normalize strings
def _parse_coord(v):
    if v is None or v == "" or str(v).lower() == "null":
        return None
    try:
        return float(v)
    except:
        return None
def _norm_str(v):
    if v is None or v == "" or str(v).lower() == "null":
        return None
    return str(v)

def _build_incidents_response(incidents_payloads, filename, processing_time, media_type, source, extra):
    """Helper to shape multi-incident response with backward-compat single fields."""
    detected = len(incidents_payloads) > 0
    # Primary (first) for legacy clients expecting incident_payload / title etc
    primary_payload = incidents_payloads[0] if incidents_payloads else None
    if primary_payload:
        title = primary_payload["title"]; description = primary_payload["description"]
        severity = primary_payload["severity"]; status = primary_payload["status"]
        incident_type = primary_payload["incident_type"]; confidence = primary_payload["metadata_json"]["confidence"]
        detections = primary_payload["metadata_json"]["detections"]
        model = primary_payload["metadata_json"]["model"]
        annotated_url = primary_payload["metadata_json"].get("annotated_image_url", "").replace("http://localhost:8001", "") if primary_payload["metadata_json"].get("annotated_image_url") else None
        annotated_path = primary_payload["metadata_json"].get("annotated_image_path")
        # try to get base64 of primary
        annotated_b64 = None
        if annotated_path and Path(annotated_path).exists():
            try:
                with open(annotated_path, "rb") as f:
                    annotated_b64 = base64.b64encode(f.read()).decode()
            except:
                pass
    else:
        title = description = severity = status = incident_type = None
        confidence = 0.0; detections = []; model = HF_MODEL_ID
        annotated_url = annotated_path = annotated_b64 = None

    resp = {
        "detected": detected,
        "incident_type": incident_type,
        "title": title,
        "description": description,
        "severity": severity,
        "status": status,
        "confidence": confidence,
        "detections": detections,
        "model": model,
        "filename": filename,
        "processing_time": processing_time,
        "source": source,
        "media_type": media_type,
        "annotated_image_url": annotated_url,
        "annotated_image_path": annotated_path,
        "annotated_image_base64": annotated_b64,
        "incident_payload": primary_payload,
        # New multi fields
        "incidents": incidents_payloads,
        "incident_payloads": incidents_payloads,
        "all_incidents": incidents_payloads,
        "count": len(incidents_payloads),
    }
    resp.update(extra)
    return resp

@app.post("/api/detect/potholes")
async def detect_potholes(
    file: UploadFile = File(...),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    location_name: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    occurred_at: Optional[str] = Form(None),
    created_at: Optional[str] = Form(None),
    updated_at: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
):
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    is_image = ext in ALLOWED_IMAGE_EXTS
    is_video = ext in ALLOWED_VIDEO_EXTS
    if not is_image and not is_video:
        ct = (file.content_type or "").lower()
        if "image" in ct:
            is_image = True
        elif "video" in ct:
            is_video = True
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type {ext}. Allowed images {ALLOWED_IMAGE_EXTS} videos {ALLOWED_VIDEO_EXTS}")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    suffix = ext or (".jpg" if is_image else ".mp4")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        manual_lat = _parse_coord(latitude)
        manual_lng = _parse_coord(longitude)
        norm_location = _norm_str(location_name)
        norm_address = _norm_str(address)
        norm_occurred = _norm_str(occurred_at)
        norm_created = _norm_str(created_at)
        norm_updated = _norm_str(updated_at)
        src = source or ("manual" if is_image else "manual_video")

        if is_image:
            try:
                from PIL import Image
                import io
                im = Image.open(io.BytesIO(contents))
                im.verify()
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

            # Multi-defect detection
            multi = detect_image_multi(tmp_path)
            incidents_payloads = []
            frame_meta_for_legacy = None
            # For each incident from multi, build payload and send
            for inc in multi.get("incidents", []):
                itype = inc["incident_type"]
                # Build frame_metadata for image (no frame number)
                fm = None
                # For payload metadata, include detected_class etc via params
                # Annotated URL handling: copy to annotated dir already in multi (tmpdir is annotated dir)
                ann_path = inc.get("annotated_image_path")
                ann_url = None
                if ann_path and Path(ann_path).exists():
                    # already in ANNOTATED_DIR, just make URL
                    ann_url = f"/annotated/{Path(ann_path).name}"
                    # Also persist with absolute URL for payload
                    abs_url = f"http://localhost:8001{ann_url}"
                else:
                    abs_url = None
                payload = build_incident_payload(
                    confidence=inc["confidence"],
                    detections=inc["detections"],
                    model=inc["model"],
                    observation=None,
                    source=src,
                    filename=filename,
                    annotated_image_url=abs_url,
                    annotated_image_path=ann_path,
                    frame_metadata=fm,
                    media_type="image",
                    manual_latitude=manual_lat,
                    manual_longitude=manual_lng,
                    manual_location_name=norm_location,
                    manual_address=norm_address,
                    manual_occurred_at=norm_occurred,
                    manual_created_at=norm_created,
                    manual_updated_at=norm_updated,
                    incident_type=itype,
                    detected_class=inc.get("detected_class"),
                    vehicle_count=inc.get("vehicle_count"),
                    pedestrian_count=inc.get("pedestrian_count"),
                    extra_metadata={"all_model_results": multi.get("all_raw", {})},
                )
                send_incident(payload)
                incidents_payloads.append(payload)

            # keep all_raw for debugging but payloads contain only final incident

            return _build_incidents_response(
                incidents_payloads, filename, multi.get("processing_time", 0), "image", "manual",
                extra={
                    "traffic_meta": multi.get("traffic_meta"),
                    "all_raw": multi.get("all_raw"),
                }
            )
        else:
            # VIDEO – multi
            multi_v = process_video_multi(tmp_path)
            incidents_payloads = []
            for inc in multi_v.get("incidents", []):
                itype = inc["incident_type"]
                ann_path = inc.get("annotated_image_path")
                ann_url = f"/annotated/{Path(ann_path).name}" if ann_path and Path(ann_path).exists() else None
                abs_url = f"http://localhost:8001{ann_url}" if ann_url else None
                fm = {
                    "frame_number": inc.get("frame_number"),
                    "video_timestamp": inc.get("video_timestamp"),
                    "confidence": inc.get("confidence"),
                    "bounding_boxes": inc.get("detections"),
                } if inc.get("frame_number") is not None else None
                payload = build_incident_payload(
                    confidence=inc["confidence"],
                    detections=inc["detections"],
                    model=inc["model"],
                    observation=None,
                    source=src,
                    filename=filename,
                    annotated_image_url=abs_url,
                    annotated_image_path=ann_path,
                    frame_metadata=fm,
                    media_type="video",
                    manual_latitude=manual_lat,
                    manual_longitude=manual_lng,
                    manual_location_name=norm_location,
                    manual_address=norm_address,
                    manual_occurred_at=norm_occurred,
                    manual_created_at=norm_created,
                    manual_updated_at=norm_updated,
                    incident_type=itype,
                    detected_class=inc.get("detected_class"),
                    vehicle_count=inc.get("vehicle_count"),
                    pedestrian_count=inc.get("pedestrian_count"),
                )
                send_incident(payload)
                incidents_payloads.append(payload)

            # Build legacy Best_frame etc from first payload if any
            best_frame = None
            if multi_v.get("incidents"):
                b = max(multi_v["incidents"], key=lambda x: x["confidence"])
                best_frame = {"frame_number": b.get("frame_number"), "timestamp": b.get("video_timestamp"), "confidence": b["confidence"], "detections": b["detections"]}

            # Keep legacy process_video primary fields for compat? Use multi_v but also legacy top-level
            primary = incidents_payloads[0] if incidents_payloads else None
            # Build annotated base64 for primary
            ann_b64 = None
            if primary and primary["metadata_json"].get("annotated_image_path") and Path(primary["metadata_json"]["annotated_image_path"]).exists():
                try:
                    with open(primary["metadata_json"]["annotated_image_path"], "rb") as f:
                        ann_b64 = base64.b64encode(f.read()).decode()
                except:
                    pass

            legacy_incident_type = primary["incident_type"] if primary else None
            legacy_title = primary["title"] if primary else None
            legacy_desc = primary["description"] if primary else None
            legacy_sev = primary["severity"] if primary else None
            legacy_status = primary["status"] if primary else None
            legacy_conf = primary["metadata_json"]["confidence"] if primary else 0.0
            legacy_dets = primary["metadata_json"]["detections"] if primary else []

            return {
                "detected": len(incidents_payloads) > 0,
                "incident_type": legacy_incident_type,
                "title": legacy_title,
                "description": legacy_desc,
                "severity": legacy_sev,
                "status": legacy_status,
                "confidence": legacy_conf,
                "detections": legacy_dets,
                "frame_detections": multi_v.get("frame_detections", []),
                "frames_processed": multi_v.get("frames_processed"),
                "total_frames": multi_v.get("total_frames"),
                "model": primary["metadata_json"]["model"] if primary else HF_MODEL_ID,
                "filename": filename,
                "processing_time": multi_v.get("processing_time", 0),
                "source": src,
                "media_type": "video",
                "annotated_image_url": primary["metadata_json"].get("annotated_image_url", "").replace("http://localhost:8001", "") if primary and primary["metadata_json"].get("annotated_image_url") else None,
                "annotated_image_path": primary["metadata_json"].get("annotated_image_path") if primary else None,
                "annotated_image_base64": ann_b64,
                "best_frame": best_frame,
                "incident_payload": primary,
                "incidents": incidents_payloads,
                "incident_payloads": incidents_payloads,
                "all_incidents": incidents_payloads,
                "count": len(incidents_payloads),
                "traffic_aggregate": multi_v.get("traffic_aggregate"),
            }
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except:
            pass


@app.post("/api/observation-status")
def create_observation_status(payload: dict):
    """Dedicated endpoint for clean/observation status. Stores locally; forwards to external if configured."""
    try:
        from observation_worker import get_ai_db
    except ImportError:
        from ai.observation_worker import get_ai_db
    import json
    from datetime import datetime, timezone
    obs_id = payload.get("observation_id") or payload.get("observationId") or f"manual-{int(time.time()*1000)}"
    # Try to forward externally if configured, but always store locally
    try:
        from incident_client import send_observation_status
    except ImportError:
        from ai.incident_client import send_observation_status
    try:
        send_observation_status(payload)
    except Exception as e:
        print(f"[OBS_STATUS API] forward failed: {e}")
    # also persist locally for road status display
    try:
        conn = get_ai_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO observation_analysis
            (observation_id, bus_id, route_id, image_path, analysis_status, detected, confidence, incident_payload_json, analyzed_at, observation_status, status, observation_status_json, all_model_results_json, media_type)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            obs_id,
            payload.get("bus_id"),
            payload.get("route_id"),
            payload.get("image_path") or "",
            "analyzed",
            0,
            0.0,
            None,
            datetime.now(timezone.utc).isoformat(),
            "clear",
            "clear",
            json.dumps(payload),
            json.dumps(payload.get("metadata_json", {}).get("all_model_results") or payload.get("all_model_results") or {}),
            payload.get("media_type") or "image",
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[OBS_STATUS API] local persist failed: {e}")
    return {"ok": True, "observation_id": obs_id, "status": payload.get("status","clear")}

@app.get("/api/observation-status")
def list_observation_status():
    try:
        from observation_worker import get_ai_db
    except ImportError:
        from ai.observation_worker import get_ai_db
    conn = get_ai_db()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM observation_analysis WHERE observation_status='clear' OR status='clear' ORDER BY analyzed_at DESC LIMIT 50")
    except:
        cur.execute("SELECT * FROM observation_analysis WHERE detected=0 ORDER BY analyzed_at DESC LIMIT 50")
    rows = cur.fetchall()
    conn.close()
    import json
    out=[]
    for r in rows:
        d=dict(r)
        for k in ["observation_status_json","all_model_results_json","incident_payload_json"]:
            if d.get(k):
                try:
                    nk=k.replace("_json","")
                    if nk=="observation_status": d["observation_status_payload"]=json.loads(d[k])
                    else: d[nk]=json.loads(d[k])
                except:
                    pass
        out.append(d)
    return out

@app.get("/api/road-status")
def road_status():
    """Latest road status for dashboard: clear if last observation had no incident."""
    try:
        from observation_worker import get_ai_db
    except ImportError:
        from ai.observation_worker import get_ai_db
    conn=get_ai_db()
    cur=conn.cursor()
    cur.execute("SELECT * FROM observation_analysis ORDER BY analyzed_at DESC LIMIT 1")
    row=cur.fetchone()
    conn.close()
    if not row:
        return {"status":"unknown","message":"no observations yet"}
    d=dict(row)
    import json
    for k in ["observation_status_json","incident_payload_json"]:
        if d.get(k):
            try:
                d[k.replace("_json","_payload") if "observation_status" in k else "incident_payload"]=json.loads(d[k])
            except:
                pass
    if d.get("detected")==0 or d.get("observation_status")=="clear" or d.get("status")=="clear":
        return {"status":"clear","observation":d, "message":"Road Clear"}
    return {"status":"incident","observation":d, "message":"Incident detected"}

@app.get("/api/observations/analysis")
def list_analysis():
    try:
        from observation_worker import get_ai_db
    except ImportError:
        from ai.observation_worker import get_ai_db
    conn = get_ai_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM observation_analysis ORDER BY analyzed_at DESC")
    rows = cur.fetchall()
    conn.close()
    import json
    out = []
    for r in rows:
        d = dict(r)
        for k in ["detections_json","incident_payload_json","frame_metadata_json","incident_payloads_json","all_model_results_json","observation_status_json"]:
            if d.get(k):
                try:
                    nk = k.replace("_json","")
                    if nk=="incident_payload": d["incident_payload"]=json.loads(d[k])
                    elif nk=="incident_payloads": d["incident_payloads"]=json.loads(d[k])
                    elif nk=="observation_status": d["observation_status_payload"]=json.loads(d[k])
                    elif nk=="detections": d["detections"]=json.loads(d[k])
                    elif nk=="frame_metadata": d["frame_metadata"]=json.loads(d[k])
                    else: d[nk]=json.loads(d[k])
                except:
                    pass
        out.append(d)
    return out

# --- Manual AI Demo (no incident creation) ---
@app.post("/api/demo/detect")
async def demo_detect(
    file: UploadFile = File(...),
    model: str = Form("pothole"),
):
    """
    Manual demo inference — does NOT create incidents, work orders, or DB side-effects.
    Reuses existing pretrained models via multi_detector / model_registry.
    model: pothole | damaged_road | waterlogging
    Returns: detected, incident_type, confidence, detections, model, annotated_image_base64/url
    """
    selection = (model or "pothole").strip().lower().replace(" ", "_").replace("-", "_")
    # normalize aliases
    if selection in {"pothole", "potholes"}:
        selection = "pothole"
    elif selection in {"damaged_road", "damagedroad", "road_damage"}:
        selection = "damaged_road"
    elif selection == "waterlogging":
        selection = "waterlogging"
    else:
        raise HTTPException(status_code=400, detail="Invalid model. Choose: pothole, damaged_road, waterlogging")

    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    ct = (file.content_type or "").lower()
    is_image = ext in ALLOWED_IMAGE_EXTS or ct.startswith("image/")
    if not is_image:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{ext or ct}'. Allowed: JPG, JPEG, PNG, WEBP")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5 MB)")
    # validate image
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(contents))
        im.verify()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    suffix = ext or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # waterlogging: check registry before inference
        if selection == "waterlogging":
            try:
                from model_registry import MODEL_REGISTRY as REG
            except ImportError:
                from ai.model_registry import MODEL_REGISTRY as REG
            cfg = REG.get("waterlogging", {})
            if not cfg.get("enabled") or not cfg.get("hf_model_id"):
                return {
                    "detected": False,
                    "incident_type": "waterlogging",
                    "confidence": 0.0,
                    "detections": [],
                    "model": cfg.get("hf_model_id") or None,
                    "model_configured": False,
                    "message": "Waterlogging detection model is not currently configured. Plug a compatible pretrained model into model_registry (e.g. FloodNet/SWaM segmentation) to enable.",
                    "annotated_image_base64": None,
                    "annotated_image_url": None,
                    "filename": filename,
                }

        # Run only the selected model to guarantee no cross-type fake mapping
        dets: list = []
        model_id: str = ""
        start = time.time()
        if selection == "pothole":
            try:
                from multi_detector import detect_pothole_model, annotate_image, get_model
            except ImportError:
                from ai.multi_detector import detect_pothole_model, annotate_image, get_model
            dets = detect_pothole_model(tmp_path)
            try:
                from model_registry import MODEL_REGISTRY as REG
            except ImportError:
                from ai.model_registry import MODEL_REGISTRY as REG
            model_id = REG.get("potholes", {}).get("hf_model_id", HF_MODEL_ID)
        elif selection == "damaged_road":
            try:
                from multi_detector import detect_road_damage, annotate_image
            except ImportError:
                from ai.multi_detector import detect_road_damage, annotate_image
            dets = detect_road_damage(tmp_path)
            try:
                from model_registry import MODEL_REGISTRY as REG
            except ImportError:
                from ai.model_registry import MODEL_REGISTRY as REG
            model_id = REG.get("road_damage", {}).get("hf_model_id", "")
        elif selection == "waterlogging":
            try:
                from multi_detector import detect_waterlogging
            except ImportError:
                from ai.multi_detector import detect_waterlogging
            wr = detect_waterlogging(tmp_path)
            if wr.get("configured") is False:
                return {
                    "detected": False,
                    "incident_type": "waterlogging",
                    "confidence": 0.0,
                    "detections": [],
                    "model": wr.get("model"),
                    "model_configured": False,
                    "message": "Waterlogging detection model is not currently configured.",
                    "annotated_image_base64": None,
                    "annotated_image_url": None,
                    "filename": filename,
                    "water_score": 0.0,
                }
            # wr contains water_score, detected — Zero-shot CLIP classification — no segmentation mask
            detected = bool(wr.get("detected"))
            water_score = float(wr.get("water_score", wr.get("confidence", 0)))
            model_id = wr.get("model", "")
            annotated_path = wr.get("annotated_path")
            annotated_b64 = None
            annotated_url = None
            if annotated_path and Path(annotated_path).exists():
                annotated_url = f"/annotated/{Path(annotated_path).name}"
                try:
                    with open(annotated_path, "rb") as f:
                        annotated_b64 = base64.b64encode(f.read()).decode()
                except:
                    pass
            processing_time = round(time.time() - start, 3)
            return {
                "detected": detected,
                "incident_type": "waterlogging",
                "confidence": water_score,
                "water_score": water_score,
                "detections": [],
                "model": model_id,
                "model_configured": True,
                "message": "Waterlogging detected" if detected else "No waterlogging detected",
                "annotated_image_base64": annotated_b64,
                "annotated_image_url": annotated_url,
                "annotated_image_path": annotated_path,
                "filename": filename,
                "processing_time": processing_time,
                "count": 1 if detected else 0,
            }
        else:
            water_demo_result = None

        # Apply same plausibility gate used in multi_detector for pothole (if any)
        # For demo we trust raw dets but still filter upper-sky potholes for professionalism
        if selection == "pothole" and dets:
            try:
                from multi_detector import _filter_pothole_dets
            except ImportError:
                from ai.multi_detector import _filter_pothole_dets
            plausible, _ = _filter_pothole_dets(dets, tmp_path)
            dets = plausible

        detected = len(dets) > 0
        confidence = round(max(d["confidence"] for d in dets), 4) if dets else 0.0
        # annotate
        annotated_b64 = None
        annotated_url = None
        annotated_path = None
        if detected:
            # reuse annotate_image from multi_detector
            try:
                from multi_detector import annotate_image as _ann
            except ImportError:
                from ai.multi_detector import annotate_image as _ann
            stem = Path(filename).stem[:30].replace(" ", "_")
            out_path = str(ANNOTATED_DIR / f"demo_{selection}_{stem}_{int(time.time()*1000)}.jpg")
            _ann(tmp_path, dets, out_path)
            annotated_path = out_path
            annotated_url = f"/annotated/{Path(out_path).name}"
            try:
                with open(out_path, "rb") as f:
                    annotated_b64 = base64.b64encode(f.read()).decode()
            except:
                pass

        processing_time = round(time.time() - start, 3)

        # Incident type mapping matches backend: pothole, damaged_road, waterlogging
        out_type = {"pothole": "pothole", "damaged_road": "damaged_road", "waterlogging": "waterlogging"}[selection]

        return {
            "detected": detected,
            "incident_type": out_type,
            "confidence": confidence,
            "detections": dets,
            "model": model_id,
            "model_configured": True,
            "message": None if detected else "No road defect detected",
            "annotated_image_base64": annotated_b64,
            "annotated_image_url": annotated_url,
            "annotated_image_path": annotated_path,
            "filename": filename,
            "processing_time": processing_time,
            "count": len(dets),
        }
    except HTTPException:
        raise
    except Exception as e:
        # never expose stack
        print(f"[DEMO] inference error: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail="Inference failed. Check AI service logs.")
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except:
            pass


# --- Video demo: road condition (no DB) + ANPR ---
@app.post("/api/demo/detect-video")
async def demo_detect_video(
    file: UploadFile = File(...),
    model: str = Form("pothole"),
    interval: str = Form("3"),
):
    """Video Analyze (NO DB) — SAME sampled frames → ROAD (pothole/damaged/waterlogging) + VEHICLE SECURITY/ANPR. 1 frame per interval_sec."""
    try:
        interval_sec = float(interval or 3)
    except:
        interval_sec = 3.0
    interval_sec = max(0.5, min(10, interval_sec))
    filename = file.filename or "upload.mp4"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported video format {ext}. Allowed {ALLOWED_VIDEO_EXTS}")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(contents) > 80*1024*1024:
        raise HTTPException(status_code=400, detail="Video too large (max 80 MB)")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".mp4") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name
    try:
        sample = _sample_video_frames(tmp_path, interval_sec=interval_sec)
        frames = sample["frames"]
        # keep model param for backward compat but always run ALL road models + ANPR on same frames
        sel = (model or "pothole").strip().lower().replace(" ", "_").replace("-", "_")
        if sel in {"potholes","pothole"}: sel="pothole"
        elif sel in {"damaged_road","road_damage","damagedroad"}: sel="damaged_road"
        elif sel=="waterlogging": sel="waterlogging"
        elif sel not in {"pothole","damaged_road","waterlogging"}:
            sel="pothole"
        # lazy imports once
        try:
            from multi_detector import detect_pothole_model, _filter_pothole_dets, detect_road_damage, detect_waterlogging, annotate_image
            from model_registry import MODEL_REGISTRY as REG
            from anpr import detect_plates
        except ImportError:
            from ai.multi_detector import detect_pothole_model, _filter_pothole_dets, detect_road_damage, detect_waterlogging, annotate_image
            from ai.model_registry import MODEL_REGISTRY as REG
            from ai.anpr import detect_plates
        per_frame=[]
        counts={"pothole":0,"damaged_road":0,"waterlogging":0}
        all_plates=[]
        for f in frames:
            fp = f["path"]
            # --- ROAD CONDITION: run all 3 real models on SAME frame ---
            # pothole
            pothole_dets = detect_pothole_model(fp)
            plausible,_ = _filter_pothole_dets(pothole_dets, fp)
            pothole_dets = plausible
            pothole_detected = len(pothole_dets)>0
            pothole_conf = round(max((d["confidence"] for d in pothole_dets),default=0),4)
            # damaged road
            road_dets = detect_road_damage(fp)
            road_detected = len(road_dets)>0
            road_conf = round(max((d["confidence"] for d in road_dets),default=0),4)
            # waterlogging — Zero-shot CLIP classification — no segmentation mask
            wr = detect_waterlogging(fp)
            water_detected = bool(wr.get("detected"))
            water_score = float(wr.get("water_score", wr.get("confidence",0)))
            if pothole_detected: counts["pothole"]+=1
            if road_detected: counts["damaged_road"]+=1
            if water_detected: counts["waterlogging"]+=1
            # annotate for legacy per_frame (use selected model's annotation for backward compat display)
            ab64=None; aurl=None; dets_legacy=[]; mid_legacy=""; det_legacy=False; conf_legacy=0
            if sel=="pothole":
                dets_legacy=pothole_dets; det_legacy=pothole_detected; conf_legacy=pothole_conf; mid_legacy=REG.get("potholes",{}).get("hf_model_id","")
                if det_legacy:
                    outp=str(ANNOTATED_DIR / f"vid_{sel}_{f['frame_number']}_{int(time.time()*1000)}.jpg")
                    annotate_image(fp, dets_legacy, outp)
                    aurl=f"/annotated/{Path(outp).name}"
                    try:
                        import base64 as b64
                        with open(outp,"rb") as fh: ab64=b64.b64encode(fh.read()).decode()
                    except: pass
            elif sel=="damaged_road":
                dets_legacy=road_dets; det_legacy=road_detected; conf_legacy=road_conf; mid_legacy=REG.get("road_damage",{}).get("hf_model_id","")
                if det_legacy:
                    outp=str(ANNOTATED_DIR / f"vid_{sel}_{f['frame_number']}_{int(time.time()*1000)}.jpg")
                    annotate_image(fp, dets_legacy, outp)
                    aurl=f"/annotated/{Path(outp).name}"
                    try:
                        import base64 as b64
                        with open(outp,"rb") as fh: ab64=b64.b64encode(fh.read()).decode()
                    except: pass
            else:
                det_legacy=water_detected; conf_legacy=water_score; mid_legacy=wr.get("model","")
            # --- VEHICLE SECURITY / ANPR on SAME frame ---
            plates = detect_plates(fp)
            all_plates.extend([{**p, "frame_number": f["frame_number"], "timestamp": f["timestamp"]} for p in plates])
            per_frame.append({
                "frame_number":f["frame_number"],"timestamp":f["timestamp"],
                # legacy fields for old UI
                "detected":det_legacy,"confidence":conf_legacy,"detections":dets_legacy,"model":mid_legacy,"annotated_image_base64":ab64,"annotated_image_url":aurl,
                # new dual-mode fields
                "road": {"pothole":{"detected":pothole_detected,"confidence":pothole_conf,"detections":pothole_dets}, "damaged_road":{"detected":road_detected,"confidence":road_conf,"detections":road_dets}, "waterlogging":{"detected":water_detected,"water_score":water_score,"confidence":water_score, "note":"Zero-shot CLIP classification — no segmentation mask"}},
                "plates": plates, "plate_count": len(plates)
            })
            try: Path(fp).unlink(missing_ok=True)
            except: pass
        # vehicle security aggregates — computed from actual OCR, never hardcoded
        unique_norm = set(p["plate_normalized"] for p in all_plates if p.get("plate_normalized"))
        stolen_plates = [p for p in all_plates if p.get("stolen")]
        unique_stolen = set(p["plate_normalized"] for p in stolen_plates if p.get("plate_normalized"))
        vehicle_security={
            "frames_checked": len(frames),
            "vehicles_detected": len(all_plates),
            "plate_count": len(all_plates),
            "unique_plates": len(unique_norm),
            "stolen_vehicles": len(unique_stolen),
            "stolen_list": sorted(list(unique_stolen)),
            "stolen_details": stolen_plates,
            "unique_plate_list": sorted(list(unique_norm)),
            "hit_and_run": "Hit-and-run analysis: vehicle tracking/collision evidence model not configured",
        }
        road_summary={
            "duration": sample["duration"], "frames_sampled": len(frames),
            "pothole_detections": counts["pothole"], "damaged_road_detections": counts["damaged_road"], "waterlogging_detections": counts["waterlogging"],
        }
        return {
            "filename": filename,
            "duration": sample["duration"],
            "fps": sample["fps"],
            "total_frames": sample["total_frames"],
            "frames_sampled": len(frames),
            "interval_sec": interval_sec,
            "model": sel,
            "per_frame": per_frame,
            "counts": counts,
            "road": road_summary,
            "vehicle_security": vehicle_security,
            "hit_and_run": vehicle_security["hit_and_run"],
            "summary": f"Video: {filename} Duration: {int(sample['duration']//60):02d}:{int(sample['duration']%60):02d} Frames sampled: {len(frames)} Potholes: {counts['pothole']} Damaged roads: {counts['damaged_road']} Waterlogging: {counts['waterlogging']}",
            "vehicle_summary": f"Frames checked: {len(frames)} Unique plates: {len(unique_norm)} Stolen vehicles: {len(unique_stolen)}",
        }
    finally:
        try: Path(tmp_path).unlink(missing_ok=True)
        except: pass

@app.post("/api/demo/anpr")
async def demo_anpr(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    is_img = ext in ALLOWED_IMAGE_EXTS or (file.content_type or "").startswith("image/")
    if not is_img:
        raise HTTPException(status_code=400, detail="Upload an image (jpg/png/webp)")
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    suffix = ext or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents); tmp_path=tmp.name
    try:
        try:
            from anpr import detect_plates, annotate_plates, STOLEN_VEHICLES
        except ImportError:
            from ai.anpr import detect_plates, annotate_plates, STOLEN_VEHICLES
        plates = detect_plates(tmp_path)
        annotated_b64=None; annotated_url=None
        if plates:
            outp=str(ANNOTATED_DIR / f"anpr_{Path(filename).stem[:20]}_{int(time.time()*1000)}.jpg")
            annotate_plates(tmp_path, plates, outp)
            annotated_url=f"/annotated/{Path(outp).name}"
            try:
                with open(outp,"rb") as fh: annotated_b64=base64.b64encode(fh.read()).decode()
            except: pass
        return {
            "filename": filename,
            "plates": plates,
            "count": len(plates),
            "unique_plates": len(set(p["plate_normalized"] for p in plates if p["plate_normalized"])),
            "stolen_count": sum(1 for p in plates if p.get("stolen")),
            "stolen_vehicles": [p for p in plates if p.get("stolen")],
            "annotated_image_base64": annotated_b64,
            "annotated_image_url": annotated_url,
            "registry": sorted(list(STOLEN_VEHICLES)),
        }
    finally:
        try: Path(tmp_path).unlink(missing_ok=True)
        except: pass

@app.post("/api/demo/anpr-video")
async def demo_anpr_video(file: UploadFile = File(...), interval: str = Form("1")):
    try: interval_sec=float(interval or 1)
    except: interval_sec=1.0
    interval_sec=max(0.5,min(10,interval_sec))
    filename=file.filename or "upload.mp4"
    ext=Path(filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(status_code=400, detail="Upload mp4/mov/avi/mkv/webm")
    contents=await file.read()
    if not contents: raise HTTPException(status_code=400, detail="Empty file")
    print(f"[ANPR VIDEO] received video {filename} size={len(contents)} interval={interval_sec}s")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".mp4") as tmp:
        tmp.write(contents); tmp_path=tmp.name
    try:
        sample=_sample_video_frames(tmp_path, interval_sec=interval_sec)
        frames=sample["frames"]
        print(f"[ANPR VIDEO] frames checked={len(frames)} duration={sample['duration']} fps={sample['fps']}")
        try:
            from anpr import detect_plates
        except ImportError:
            from ai.anpr import detect_plates
        per_frame=[]
        all_plates=[]
        for f in frames:
            print(f"[ANPR VIDEO] running frame {f['frame_number']} @ {f['timestamp']}s")
            fp=f["path"]
            try:
                plates=detect_plates(fp)
            except Exception as e:
                print(f"[ANPR VIDEO] frame {f['frame_number']} error: {e}")
                import traceback; traceback.print_exc()
                plates=[]
            print(f"[ANPR VIDEO] frame {f['frame_number']} plates={len(plates)}")
            per_frame.append({"frame_number":f["frame_number"],"timestamp":f["timestamp"],"plates":plates,"count":len(plates)})
            all_plates.extend([{**p, "frame_number": f["frame_number"], "timestamp": f["timestamp"]} for p in plates])
            try: Path(fp).unlink(missing_ok=True)
            except: pass
        # === BEST FRAME SELECTION prioritizing crop size (REQUIRED CHANGE 1 & 8) ===
        # Filter already done in anpr.py (w<40 h<8 area<300 aspect), but re-validate
        valid_plates = [p for p in all_plates if p.get("bbox_area",0) >= 300 and p.get("bbox_width",0) >= 40 and p.get("bbox_height",0) >= 8]
        # Exclude obvious overlay text like SUBSCRIBE that has no digits (vehicle plates must contain digit)
        import re as _re
        vehicle_like = [p for p in valid_plates if _re.search(r"\d", p.get("plate_normalized") or "")]
        pool_for_best = vehicle_like if vehicle_like else (valid_plates if valid_plates else all_plates)
        # Sort by area heavily, then width, height, detector confidence
        def _best_key(p):
            return (p.get("bbox_area",0), p.get("bbox_width",0), p.get("bbox_height",0), float(p.get("detector_confidence", p.get("confidence",0))), float(p.get("ocr_confidence",0)))
        best_plate = max(pool_for_best, key=_best_key) if pool_for_best else None
        if best_plate:
            print(f"[ANPR BEST] frame={best_plate.get('frame_number')} bbox={best_plate.get('bbox')} area={best_plate.get('bbox_area')} w={best_plate.get('bbox_width')} h={best_plate.get('bbox_height')} det={best_plate.get('detector_confidence')} ocr='{best_plate.get('plate_normalized')}'")
        # === OCR BEST CROP debug images (REQUIRED CHANGE 2) ===
        best_crop_info = None
        if best_plate:
            try:
                import cv2 as cv2b
                cap2 = cv2b.VideoCapture(tmp_path)
                # seek to best frame
                bf = int(best_plate.get("frame_number",0))
                cap2.set(cv2b.CAP_PROP_POS_FRAMES, bf)
                ret2, frame2 = cap2.read()
                cap2.release()
                if ret2 and frame2 is not None:
                    h2,w2 = frame2.shape[:2]
                    x1,y1,x2,y2 = best_plate["bbox"]
                    # add 12% padding (10-15%)
                    bw2 = x2 - x1; bh2 = y2 - y1
                    pad_x = int(bw2 * 0.12); pad_y = int(bh2 * 0.12)
                    px1 = max(0, x1 - pad_x); py1 = max(0, y1 - pad_y)
                    px2 = min(w2, x2 + pad_x); py2 = min(h2, y2 + pad_y)
                    crop_best = frame2[py1:py2, px1:px2]
                    dbg_dir = Path(r"C:\Users\SRI NAGA DURGA K\OneDrive\Desktop\simulator\pothole-ai\demo_data\anpr")
                    dbg_dir.mkdir(parents=True, exist_ok=True)
                    # save original crop
                    cv2b.imwrite(str(dbg_dir / "anpr_best_plate_crop.jpg"), crop_best)
                    # upscale to ~170 height preserving aspect
                    ch2,cw2 = crop_best.shape[:2]
                    target_h = 170
                    if ch2 < target_h:
                        scale = target_h / max(1,ch2)
                        try:
                            interp = cv2b.INTER_LANCZOS4
                        except:
                            interp = cv2b.INTER_CUBIC
                        upscaled = cv2b.resize(crop_best, None, fx=scale, fy=scale, interpolation=interp)
                    else:
                        upscaled = crop_best
                    cv2b.imwrite(str(dbg_dir / "anpr_best_plate_upscaled.jpg"), upscaled)
                    print(f"[ANPR BEST CROP] saved crop {crop_best.shape[1]}x{crop_best.shape[0]} upscaled {upscaled.shape[1]}x{upscaled.shape[0]} bbox [{px1},{py1},{px2},{py2}]")
                    best_crop_info = {"crop_w": cw2, "crop_h": ch2, "upscaled_w": upscaled.shape[1], "upscaled_h": upscaled.shape[0], "padded_bbox": [px1,py1,px2,py2]}
                    # Run EasyOCR + TrOCR comparison on best upscaled crop (REQUIRED CHANGE 4)
                    try:
                        from anpr import _get_easyocr, normalize_plate as _norm, ALLOWLIST
                        import numpy as np
                        reader = _get_easyocr()
                        if reader is not None:
                            try:
                                res_e = reader.readtext(upscaled, allowlist=ALLOWLIST)
                            except TypeError:
                                res_e = reader.readtext(upscaled)
                            if res_e:
                                cur = max(res_e, key=lambda x: x[2])
                                print(f"[OCR] EASYOCR best_crop raw_text='{cur[1]}' conf={cur[2]:.4f} normalized='{_norm(str(cur[1]))}' frame={bf}")
                            else:
                                print(f"[OCR] EASYOCR best_crop no text frame={bf}")
                        # TrOCR on best crop if available
                        try:
                            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
                            from PIL import Image
                            import torch
                            proc = TrOCRProcessor.from_pretrained("Awiros/anpr-ocr")
                            mdl = VisionEncoderDecoderModel.from_pretrained("Awiros/anpr-ocr")
                            img_pil = Image.fromarray(cv2b.cvtColor(upscaled, cv2b.COLOR_BGR2RGB))
                            pix = proc(images=img_pil, return_tensors="pt").pixel_values
                            gen = mdl.generate(pix)
                            txt_t = proc.batch_decode(gen, skip_special_tokens=True)[0]
                            print(f"[OCR] TROCR best_crop raw_text='{txt_t}' normalized='{_norm(txt_t)}' frame={bf}")
                        except Exception as e_t:
                            print(f"[OCR] TROCR not available: {e_t}")
                    except Exception as e_o:
                        print(f"[OCR] best crop comparison failed: {e_o}")
            except Exception as e_c:
                print(f"[ANPR BEST CROP] failed: {e_c}")
        # === TEMPORAL CONSENSUS (REQUIRED CHANGE 5) ===
        # Collect top 7 largest area candidates
        top_candidates = sorted(pool_for_best, key=_best_key, reverse=True)[:7]
        for c in top_candidates:
            print(f"[OCR] frame={c.get('frame_number')} variant=temporal raw_text='{c.get('plate_text')}' normalized='{c.get('plate_normalized')}' confidence={c.get('ocr_confidence')}")
        # Consensus: most common normalized among top candidates (length>=6)
        from collections import Counter
        norms_top = [c.get("plate_normalized") for c in top_candidates if c.get("plate_normalized") and len(c.get("plate_normalized"))>=6]
        consensus = Counter(norms_top).most_common(1)
        if consensus and consensus[0][1] >= 2:
            print(f"[ANPR CONSENSUS] promoted '{consensus[0][0]}' count={consensus[0][1]}")
            # if consensus differs from best_plate, create a synthetic best for frontend display (not hardcoded, derived from consensus)
            if best_plate and best_plate.get("plate_normalized") != consensus[0][0]:
                # find a candidate with consensus
                for c in top_candidates:
                    if c.get("plate_normalized")==consensus[0][0]:
                        best_plate = c
                        break
        # === legacy clustering for unique/stolen counts ===
        def _bbox_iou(a,b):
            xa1,ya1,xa2,ya2=a; xb1,yb1,xb2,yb2=b
            ix1=max(xa1,xb1); iy1=max(ya1,yb1); ix2=min(xa2,xb2); iy2=min(ya2,yb2)
            iw=max(0,ix2-ix1); ih=max(0,iy2-iy1)
            inter=iw*ih
            area_a=(xa2-xa1)*(ya2-ya1); area_b=(xb2-xb1)*(yb2-yb1)
            return inter/max(1,area_a+area_b-inter)
        clusters=[]
        for p in all_plates:
            placed=False
            for cl in clusters:
                rep=cl[0]
                iou = _bbox_iou(p["bbox"], rep["bbox"]) if p.get("bbox") and rep.get("bbox") else 0
                norm_p = p.get("plate_normalized") or p.get("normalized_plate") or ""
                norm_r = rep.get("plate_normalized") or rep.get("normalized_plate") or ""
                same_norm = norm_p and norm_r and norm_p==norm_r
                prefix_match = norm_p and norm_r and (norm_p.startswith(norm_r) or norm_r.startswith(norm_p)) and min(len(norm_p),len(norm_r))>=6
                if iou>0.2 or same_norm or prefix_match:
                    cl.append(p); placed=True; break
            if not placed:
                clusters.append([p])
        aggregated_best=[]
        for cl in clusters:
            readable=[c for c in cl if (c.get("plate_normalized") or c.get("normalized_plate"))]
            pool = readable if readable else cl
            def ck(c):
                n=len(c.get("plate_normalized") or c.get("normalized_plate") or "")
                return (c.get("bbox_area",0), n, float(c.get("ocr_confidence",0)), float(c.get("detector_confidence", c.get("confidence",0))))
            best=max(pool, key=ck)
            aggregated_best.append(best)
            norms=set(c.get("plate_normalized") or c.get("normalized_plate") or "—" for c in cl)
            print(f"[ANPR VIDEO AGG] cluster size={len(cl)} norms={norms} best='{best.get('plate_normalized')}' ocr_conf={best.get('ocr_confidence')} det_conf={best.get('detector_confidence')} area={best.get('bbox_area')}")
        unique=set(p["plate_normalized"] for p in aggregated_best if p["plate_normalized"])
        unique_all=set(p["plate_normalized"] for p in all_plates if p["plate_normalized"])
        unique = unique_all
        stolen=[p for p in aggregated_best if p.get("stolen")]
        unique_stolen=set(p["plate_normalized"] for p in stolen if p["plate_normalized"])
        print(f"[ANPR VIDEO] final result frames_checked={len(frames)} plates_detected={len(all_plates)} unique={len(unique)} stolen={len(unique_stolen)} clusters={len(clusters)} best_frame={best_plate.get('frame_number') if best_plate else None}")
        return {
            "filename": filename,
            "duration": sample["duration"],
            "fps": sample["fps"],
            "total_frames": sample["total_frames"],
            "frames_sampled": len(frames),
            "frames_checked": len(frames),
            "interval_sec": interval_sec,
            "per_frame": per_frame,
            "best_plate": best_plate,
            "best_crop_info": best_crop_info,
            "unique_plates": len(unique),
            "stolen_vehicles": len(unique_stolen),
            "stolen_list": sorted(list(unique_stolen)),
            "all_plates": all_plates,
            "aggregated_plates": aggregated_best,
            "clusters": len(clusters),
            "summary": f"Frames checked: {len(frames)} Unique plates: {len(unique)} Stolen vehicles: {len(unique_stolen)}",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ANPR VIDEO] failed: {e}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"ANPR video failed: {e}")
    finally:
        try: Path(tmp_path).unlink(missing_ok=True)
        except: pass

@app.post("/api/demo/video-to-pipeline")
async def video_to_pipeline(
    file: UploadFile = File(...),
    bus_id: str = Form("BVR-101"),
    route_id: str = Form("BVR001"),
    latitude: str = Form("16.5449"),
    longitude: str = Form("81.5212"),
    interval: str = Form("3"),
):
    try: interval_sec=float(interval or 3)
    except: interval_sec=3.0
    interval_sec=max(0.5,min(10,interval_sec))
    filename=file.filename or "upload.mp4"
    ext=Path(filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(status_code=400, detail="Unsupported video")
    contents=await file.read()
    if not contents: raise HTTPException(status_code=400, detail="Empty")
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext or ".mp4") as tmp:
        tmp.write(contents); tmp_path=tmp.name
    try:
        sample=_sample_video_frames(tmp_path, interval_sec=interval_sec)
        import requests as req
        backend = os.getenv("BACKEND_URL", os.getenv("SIMULATOR_BACKEND_URL", "http://localhost:8000"))
        # backend base for bus-observations
        sent=[]
        for f in sample["frames"]:
            fp=f["path"]
            try:
                with open(fp,"rb") as fh:
                    files={"image": (f"frame_{f['frame_number']}.jpg", fh, "image/jpeg")}
                    data={"bus_id":bus_id,"route_id":route_id,"latitude":latitude,"longitude":longitude,"location_name":"Video Frame Upload","occurred_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}
                    r=req.post(f"{backend}/api/bus-observations", files=files, data=data, timeout=15)
                    sent.append({"frame_number":f["frame_number"],"timestamp":f["timestamp"],"status":r.status_code,"response": r.json() if r.headers.get("content-type","").startswith("application/json") else r.text[:300]})
            except Exception as e:
                sent.append({"frame_number":f["frame_number"],"error":str(e)})
            try: Path(fp).unlink(missing_ok=True)
            except: pass
        return {"filename":filename,"duration":sample["duration"],"frames_sampled":len(sample["frames"]),"interval_sec":interval_sec,"sent":sent,"count":len([s for s in sent if s.get("status")==201])}
    finally:
        try: Path(tmp_path).unlink(missing_ok=True)
        except: pass

@app.get("/api/demo/anpr/demo-files")
def demo_files():
    files=[]
    if DEMO_ANPR_DIR.exists():
        for p in DEMO_ANPR_DIR.iterdir():
            if p.is_file():
                files.append({"name":p.name,"url":f"/demo-data/anpr/{p.name}","size":p.stat().st_size})
    return {"dir":str(DEMO_ANPR_DIR),"files":files,"registry":sorted(list(__import__('anpr').STOLEN_VEHICLES if False else [])) if False else None}

# Serve demo image bytes for frontend Load Demo button fallback
@app.get("/api/demo/anpr/demo-image")
def demo_image():
    import fastapi.responses
    p = DEMO_ANPR_DIR / "demo_stolen_AP39AB1234.jpg"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Demo image not found")
    return fastapi.responses.FileResponse(str(p), media_type="image/jpeg", filename=p.name)

@app.get("/api/demo/anpr/demo-video")
def demo_video():
    import fastapi.responses
    p = DEMO_ANPR_DIR / "demo_stolen_AP39AB1234.mp4"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Demo video not found")
    return fastapi.responses.FileResponse(str(p), media_type="video/mp4", filename=p.name)

@app.get("/")
def root():
    return {"message": "Urban Intelligence AI running", "model": HF_MODEL_ID, "endpoints": ["/api/detect/potholes", "/api/demo/detect", "/api/demo/detect-video", "/api/demo/anpr", "/api/demo/anpr-video", "/health", "/api/models"]}
