"""
Observation worker: polls simulator backend for bus_observations and runs MULTI-DEFECT detection.
Handles image and video: multi_detector + video_processor_multi.
Preserves simulator metadata exactly – never uses browser/demo location.
Supports multiple incidents per observation (stored as JSON arrays + legacy single fields for compat).
"""
import os
import time
import json
import sqlite3
import threading
import requests
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timezone

SIMULATOR_BACKEND_URL = os.getenv("SIMULATOR_BACKEND_URL", "http://localhost:8000")
AI_BACKEND_URL = os.getenv("AI_BACKEND_URL", "http://localhost:8001")
OBSERVATION_POLL_INTERVAL = int(os.getenv("OBSERVATION_POLL_INTERVAL", "5"))
AI_DB_PATH = Path(__file__).parent / "ai_observations.db"

ANNOTATED_DIR = Path(tempfile.gettempdir()) / "pothole_ai_annotated"
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def get_ai_db():
    conn = sqlite3.connect(str(AI_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_ai_db():
    conn = get_ai_db()
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS observation_analysis (
        observation_id TEXT PRIMARY KEY,
        bus_id TEXT,
        route_id TEXT,
        image_path TEXT,
        analysis_status TEXT,
        detected INTEGER,
        confidence REAL,
        detections_json TEXT,
        incident_payload_json TEXT,
        analyzed_at TEXT,
        error TEXT,
        annotated_image_path TEXT,
        annotated_image_url TEXT,
        frame_metadata_json TEXT,
        media_type TEXT
    )
    """)
    # Ensure new columns for multi-defect + clean observation status
    for col, coltype in [
        ("annotated_image_path", "TEXT"),
        ("annotated_image_url", "TEXT"),
        ("frame_metadata_json", "TEXT"),
        ("media_type", "TEXT"),
        ("incident_type", "TEXT"),
        ("model_name", "TEXT"),
        ("incident_payloads_json", "TEXT"),
        ("all_model_results_json", "TEXT"),
        ("observation_status", "TEXT"),
        ("status", "TEXT"),
        ("observation_status_json", "TEXT"),
    ]:
        try:
            cur.execute(f"ALTER TABLE observation_analysis ADD COLUMN {col} {coltype}")
        except:
            pass
    conn.commit()
    conn.close()


init_ai_db()


def fetch_observations():
    url = f"{SIMULATOR_BACKEND_URL}/api/bus-observations"
    try:
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[WORKER] fetch observations failed: {e}")
        return []


def download_image(image_url_or_path: str) -> str:
    if image_url_or_path.startswith("http"):
        url = image_url_or_path
    elif image_url_or_path.startswith("/"):
        url = f"{SIMULATOR_BACKEND_URL}{image_url_or_path}"
    else:
        url = f"{SIMULATOR_BACKEND_URL}/{image_url_or_path}"
    possible_local = Path(__file__).parent.parent.parent / "simulator" / image_url_or_path.lstrip("/")
    if possible_local.exists():
        return str(possible_local)
    p = Path(image_url_or_path)
    if p.exists():
        return str(p)
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        suffix = Path(image_url_or_path).suffix or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(resp.content)
            return tmp.name
    except Exception as e:
        print(f"[WORKER] download media failed {url}: {e}")
        if possible_local.exists():
            return str(possible_local)
        raise


def _persist_annotated(src_path: str, observation_id: str, suffix_hint: str = "") -> tuple:
    if not src_path or not Path(src_path).exists():
        return None, None
    ext = Path(src_path).suffix or ".jpg"
    dest_name = f"{observation_id}{suffix_hint}_annotated{ext}"
    dest = ANNOTATED_DIR / dest_name
    try:
        shutil.copy2(src_path, dest)
        url = f"/annotated/{dest_name}"
        return str(dest), url
    except Exception as e:
        print(f"[WORKER] Failed to persist annotated {src_path}: {e}")
        return src_path, None


def process_observation(obs: dict):
    obs_id = obs.get("id")
    conn = get_ai_db()
    cur = conn.cursor()
    cur.execute("SELECT analysis_status FROM observation_analysis WHERE observation_id=?", (obs_id,))
    row = cur.fetchone()
    if row and row["analysis_status"] == "analyzed":
        conn.close()
        return
    conn.close()

    image_ref = obs.get("image_path") or obs.get("image_url") or ""
    media_type = "video" if Path(image_ref).suffix.lower() in VIDEO_EXTS else "image"
    print(f"[AI] New {media_type} observation {obs_id} bus {obs.get('bus_id')} ref {image_ref}")

    conn = get_ai_db()
    cur = conn.cursor()
    cur.execute("INSERT OR REPLACE INTO observation_analysis (observation_id, bus_id, route_id, image_path, analysis_status, analyzed_at, media_type) VALUES (?,?,?,?,?,?,?)",
                (obs_id, obs.get("bus_id"), obs.get("route_id"), image_ref, "processing", datetime.now(timezone.utc).isoformat(), media_type))
    conn.commit()
    conn.close()

    local_path = None
    try:
        try:
            from multi_detector import detect_image_multi
            from video_processor import process_video_multi
            from incident_client import build_incident_payload, send_incident, build_observation_status, send_observation_status
        except ImportError:
            from ai.multi_detector import detect_image_multi
            from ai.video_processor import process_video_multi
            from ai.incident_client import build_incident_payload, send_incident, build_observation_status, send_observation_status

        local_path = download_image(image_ref)
        print(f"[AI] Running multi-defect models on {local_path} (type={media_type})")

        all_payloads = []
        primary_payload = None
        legacy_detections = []
        legacy_conf = 0.0
        legacy_ann_path = None
        legacy_ann_url = None
        frame_metadata = None
        model_name = None
        incident_type = None
        all_model_results = {}
        observation_status_payload = None
        obs_status = None

        # Safety filter: simulator road-condition scope (single source of truth)
        ALLOWED_SIM_TYPES = {"potholes", "road_damage", "waterlogging"}

        if media_type == "video":
            multi_v = process_video_multi(local_path)
            print(f"[AI] Video multi result incidents={len(multi_v.get('incidents', []))} frames={multi_v.get('frames_processed')}/{multi_v.get('total_frames')}")
            all_model_results = multi_v.get("all_raw_aggregated") or multi_v.get("all_raw") or {}
            # also include frame_detections for debugging
            if multi_v.get("frame_detections"):
                all_model_results["frame_detections"] = multi_v.get("frame_detections")
            for inc in multi_v.get("incidents", []):
                itype = inc["incident_type"]
                if itype not in ALLOWED_SIM_TYPES:
                    print(f"[ROAD_FILTER] Skipping non-road incident {itype} for observation {obs_id}")
                    continue
                ann_src = inc.get("annotated_image_path")
                suffix = f"_{itype}"
                ann_path, ann_url = _persist_annotated(ann_src, obs_id, suffix_hint=suffix)
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
                    observation=obs,
                    source="bus_observation",
                    filename=obs.get("image_filename"),
                    annotated_image_url=f"{AI_BACKEND_URL}{ann_url}" if ann_url else None,
                    annotated_image_path=ann_path,
                    frame_metadata=fm,
                    media_type=media_type,
                    incident_type=itype,
                    detected_class=inc.get("detected_class"),
                    vehicle_count=inc.get("vehicle_count"),
                    pedestrian_count=inc.get("pedestrian_count"),
                )
                send_incident(payload)
                all_payloads.append(payload)
                if not primary_payload:
                    primary_payload = payload
                    legacy_ann_path = ann_path
                    legacy_ann_url = ann_url
                    frame_metadata = fm
                    model_name = inc["model"]
                    incident_type = itype
                    legacy_conf = inc["confidence"]
                    legacy_detections = inc["detections"]
            if not all_payloads:
                print("[AI] No defects detected in video - creating clean observation status")
                legacy_detections = multi_v.get("frame_detections", [])
                observation_status_payload = build_observation_status(obs, media_type=media_type, all_model_results=all_model_results or multi_v.get("all_raw") or {})
                obs_status = "clear"
                send_observation_status(observation_status_payload)
        else:
            multi = detect_image_multi(local_path)
            print(f"[AI] Image multi result incidents={len(multi.get('incidents', []))}")
            all_model_results = multi.get("all_raw", {})
            for inc in multi.get("incidents", []):
                itype = inc["incident_type"]
                if itype not in ALLOWED_SIM_TYPES:
                    print(f"[ROAD_FILTER] Skipping non-road incident {itype} for observation {obs_id}")
                    continue
                ann_src = inc.get("annotated_image_path")
                suffix = f"_{itype}"
                ann_path, ann_url = _persist_annotated(ann_src, obs_id, suffix_hint=suffix)
                payload = build_incident_payload(
                    confidence=inc["confidence"],
                    detections=inc["detections"],
                    model=inc["model"],
                    observation=obs,
                    source="bus_observation",
                    filename=obs.get("image_filename"),
                    annotated_image_url=f"{AI_BACKEND_URL}{ann_url}" if ann_url else None,
                    annotated_image_path=ann_path,
                    frame_metadata=None,
                    media_type=media_type,
                    incident_type=itype,
                    detected_class=inc.get("detected_class"),
                    vehicle_count=inc.get("vehicle_count"),
                    pedestrian_count=inc.get("pedestrian_count"),
                    extra_metadata={"all_model_results": multi.get("all_raw", {})},
                )
                send_incident(payload)
                all_payloads.append(payload)
                if not primary_payload:
                    primary_payload = payload
                    legacy_ann_path = ann_path
                    legacy_ann_url = ann_url
                    model_name = inc["model"]
                    incident_type = itype
                    legacy_conf = inc["confidence"]
                    legacy_detections = inc["detections"]
                    frame_metadata = {"frame_number": None, "video_timestamp": None, "confidence": inc["confidence"], "bounding_boxes": inc["detections"]}
            if not all_payloads:
                print("[AI] No defects detected in image - creating clean observation status")
                observation_status_payload = build_observation_status(obs, media_type=media_type, all_model_results=all_model_results)
                obs_status = "clear"
                send_observation_status(observation_status_payload)

        # Persist analysis – keep legacy columns for compat + new multi columns + clean observation
        conn = get_ai_db()
        cur = conn.cursor()
        analyzed_at = datetime.now(timezone.utc).isoformat()
        # For clean observations, detected=0, status=clear, incident_payload NULL, observation_status_json holds clear payload
        if observation_status_payload:
            cur.execute("""
                INSERT OR REPLACE INTO observation_analysis
                (observation_id, bus_id, route_id, image_path, analysis_status, detected, confidence, detections_json, incident_payload_json, analyzed_at, annotated_image_path, annotated_image_url, frame_metadata_json, media_type, incident_type, model_name, incident_payloads_json, all_model_results_json, observation_status, status, observation_status_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                obs_id, obs.get("bus_id"), obs.get("route_id"), image_ref,
                "analyzed", 0, 0.0,
                json.dumps([]),
                None,
                analyzed_at,
                None, None,
                None,
                media_type,
                None,
                None,
                None,
                json.dumps(all_model_results),
                obs_status,
                obs_status,
                json.dumps(observation_status_payload),
            ))
        else:
            cur.execute("""
                INSERT OR REPLACE INTO observation_analysis
                (observation_id, bus_id, route_id, image_path, analysis_status, detected, confidence, detections_json, incident_payload_json, analyzed_at, annotated_image_path, annotated_image_url, frame_metadata_json, media_type, incident_type, model_name, incident_payloads_json, all_model_results_json, observation_status, status, observation_status_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                obs_id, obs.get("bus_id"), obs.get("route_id"), image_ref,
                "analyzed", 1, legacy_conf,
                json.dumps(all_payloads[0]["metadata_json"]["detections"] if all_payloads else legacy_detections),
                json.dumps(primary_payload) if primary_payload else None,
                analyzed_at,
                legacy_ann_path, legacy_ann_url,
                json.dumps(frame_metadata) if frame_metadata else None,
                media_type,
                incident_type,
                model_name,
                json.dumps(all_payloads) if all_payloads else None,
                json.dumps(all_model_results),
                "incident" if all_payloads else None,
                "incident" if all_payloads else None,
                None,
            ))
        conn.commit()
        conn.close()

        # === ANPR Vehicle Security branch (separate, never blocks road AI) ===
        try:
            backend_url = os.getenv("BACKEND_URL", SIMULATOR_BACKEND_URL)
            # idempotency check via backend API (or local sqlite could also)
            # run ANPR on same local_path image
            try:
                from anpr import detect_plates, STOLEN_VEHICLES
            except ImportError:
                from ai.anpr import detect_plates, STOLEN_VEHICLES
            # Only process images (video ANPR via demo-anpr-video not via observation worker)
            if media_type == "image" and local_path and Path(local_path).exists():
                plates = detect_plates(local_path)
                print(f"[ANPR WORKER] observation {obs_id} plates={len(plates)}")
                # Choose best plate by area*conf if multiple, else first
                best = None
                if plates:
                    # plates already filtered geometry; pick largest area
                    def _k(p): return (p.get("bbox_area",0), float(p.get("detector_confidence",0)), float(p.get("ocr_confidence",0)))
                    best = max(plates, key=_k)
                    # if best has large area but OCR empty, try next readable
                    if not best.get("plate_normalized"):
                        readable=[p for p in plates if p.get("plate_normalized")]
                        if readable:
                            best = max(readable, key=_k)
                if best is None:
                    # No plate detected → store PLATE DETECTED? Actually store with empty plate as UNKNOWN
                    # Still store event with status NO PLATE? But spec says store plate events; for no plate we create UNKNOWN?
                    # Create minimal event with empty plate
                    payload_vs = {
                        "observation_id": str(obs_id),
                        "bus_id": obs.get("bus_id"),
                        "route_id": obs.get("route_id"),
                        "plate_number": "",
                        "plate_normalized": "",
                        "detector_confidence": 0,
                        "ocr_confidence": 0,
                        "stolen": False,
                        "status": "NO PLATE DETECTED",
                        "priority": "NORMAL",
                        "latitude": obs.get("latitude"),
                        "longitude": obs.get("longitude"),
                        "location_name": obs.get("location_name"),
                        "image_url": obs.get("image_url") or obs.get("local_image_url"),
                        "image_path": image_ref,
                        "bbox": None,
                    }
                else:
                    payload_vs = {
                        "observation_id": str(obs_id),
                        "bus_id": obs.get("bus_id"),
                        "route_id": obs.get("route_id"),
                        "plate_number": best.get("plate_text") or best.get("ocr_text") or "",
                        "plate_normalized": best.get("plate_normalized") or best.get("normalized_plate") or "",
                        "detector_confidence": best.get("detector_confidence") or best.get("confidence"),
                        "ocr_confidence": best.get("ocr_confidence"),
                        "stolen": bool(best.get("stolen")),
                        "status": best.get("status"),
                        "priority": best.get("priority"),
                        "latitude": obs.get("latitude"),
                        "longitude": obs.get("longitude"),
                        "location_name": obs.get("location_name"),
                        "image_url": obs.get("image_url") or obs.get("local_image_url"),
                        "image_path": image_ref,
                        "bbox": best.get("bbox"),
                    }
                # POST to backend with idempotency
                try:
                    r = requests.post(f"{backend_url}/api/vehicle-security", json=payload_vs, timeout=10)
                    print(f"[ANPR WORKER] POST vehicle-security {obs_id} status={r.status_code} {r.text[:200]}")
                except Exception as e2:
                    print(f"[ANPR WORKER] POST failed {obs_id}: {e2}")
            else:
                print(f"[ANPR WORKER] skip video observation {obs_id}")
        except Exception as e_anpr:
            print(f"[ANPR WORKER] ANPR branch failed {obs_id}: {e_anpr}")
            import traceback; traceback.print_exc()

        if local_path and tempfile.gettempdir() in local_path:
            try:
                Path(local_path).unlink(missing_ok=True)
            except:
                pass

    except Exception as e:
        print(f"[AI] Failed to process {obs_id}: {e}")
        import traceback
        traceback.print_exc()
        conn = get_ai_db()
        cur = conn.cursor()
        cur.execute("INSERT OR REPLACE INTO observation_analysis (observation_id, bus_id, route_id, image_path, analysis_status, error, analyzed_at, media_type) VALUES (?,?,?,?,?,?,?,?)",
                    (obs_id, obs.get("bus_id"), obs.get("route_id"), obs.get("image_path") or "", "failed", str(e), datetime.now(timezone.utc).isoformat(), media_type if 'media_type' in locals() else "unknown"))
        conn.commit()
        conn.close()
        if local_path and tempfile.gettempdir() in str(local_path):
            try:
                Path(local_path).unlink(missing_ok=True)
            except:
                pass


def poll_loop(stop_event=None):
    print(f"[WORKER] Starting poll loop interval={OBSERVATION_POLL_INTERVAL}s backend={SIMULATOR_BACKEND_URL} annotated={ANNOTATED_DIR}")
    while True:
        if stop_event and stop_event.is_set():
            break
        try:
            obs_list = fetch_observations()
            for obs in obs_list:
                process_observation(obs)
        except Exception as e:
            print(f"[WORKER] poll error: {e}")
        time.sleep(OBSERVATION_POLL_INTERVAL)


def start_background_worker():
    t = threading.Thread(target=poll_loop, daemon=True)
    t.start()
    return t


if __name__ == "__main__":
    poll_loop()
