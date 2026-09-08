# moves buses
import json
import random
import time
import os
import mimetypes
import uuid
from pathlib import Path
from datetime import datetime, timezone
import urllib.request
import urllib.error
import http.client
import requests

try:
    from PIL import Image as PILImage
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_MEDIA_EXTS = ALLOWED_IMAGE_EXTS | ALLOWED_VIDEO_EXTS
MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
}

# Bus Routes Data - preserved existing
BUS_ROUTES = [
    {
        "route_id": "BVR001",
        "route_name": "Bhimavaram \u2013 Palakollu",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Palakollu",
        "bus_number": "BVR-101"
    },
    {
        "route_id": "BVR002",
        "route_name": "Bhimavaram \u2013 Tadepalligudem",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Tadepalligudem",
        "bus_number": "BVR-102"
    },
    {
        "route_id": "BVR003",
        "route_name": "Bhimavaram \u2013 Narasapur",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Narasapur",
        "bus_number": "BVR-103"
    },
    {
        "route_id": "BVR004",
        "route_name": "Bhimavaram \u2013 Tanuku",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Tanuku",
        "bus_number": "BVR-104"
    },
    {
        "route_id": "BVR005",
        "route_name": "Bhimavaram \u2013 Undi",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Undi",
        "bus_number": "BVR-105"
    },
    {
        "route_id": "BVR006",
        "route_name": "Bhimavaram \u2013 Akividu",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Akividu",
        "bus_number": "BVR-106"
    },
    {
        "route_id": "BVR007",
        "route_name": "Bhimavaram \u2013 Attili",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Attili",
        "bus_number": "BVR-107"
    },
    {
        "route_id": "BVR008",
        "route_name": "Bhimavaram \u2013 Veeravasaram",
        "start_point": "Bhimavaram RTC Complex",
        "end_point": "Veeravasaram",
        "bus_number": "BVR-108"
    }
]

# --- Configuration ---
BACKEND_URL = "http://localhost:8000"
API_ENDPOINT = "http://localhost:8000/api/incidents"  # legacy incident endpoint - kept, not used for raw observations
BUS_OBSERVATION_ENDPOINT = "http://localhost:8000/api/bus-observations"
SIMULATION_INTERVAL = 3
API_TRIGGER_INTERVAL = 480  # 8 minutes = 480 seconds, set to 20 for testing

ROOT = Path(__file__).parent
ROUTES_FILE = ROOT / "routes.json"
IMAGES_DIR = ROOT / "images"

# GPS coordinates for each location_name (Bhimavaram region)
GPS_COORDS = {
    "Bhimavaram": (16.5449, 81.5212),
    "Veeravasaram": (16.5438, 81.4733),
    "Pennada": (16.5560, 81.6150),
    "Palakollu Road": (16.5200, 81.6800),
    "Palakollu": (16.5169, 81.7304),
    "Undi": (16.6023, 81.5761),
    "Attili": (16.6000, 81.6000),
    "Pentapadu": (16.7700, 81.5500),
    "Tadepalligudem": (16.8341, 81.5235),
    "Mogalthur Road": (16.4800, 81.6000),
    "Narsapur Road": (16.4500, 81.6500),
    "Narasapur": (16.4363, 81.6723),
}

TITLE_MAPPING = {
    "potholes": "Pothole detected",
    "garbage": "Garbage detected",
    "hit_and_run": "Hit and run incident detected",
    "illegal parking": "Illegal parking detected",
    "missing,damaged zebra crossing": "Damaged/missing zebra crossing detected",
    "pedestrian": "Pedestrian activity detected",
    "roadsigns": "Road sign issue detected",
    "traffic": "Traffic congestion detected",
    "waterlogging": "Waterlogging detected",
}

SEVERITY_MAPPING = {
    "potholes": "high",
    "hit_and_run": "critical",
    "garbage": "medium",
    "illegal parking": "medium",
    "missing,damaged zebra crossing": "high",
    "pedestrian": "medium",
    "roadsigns": "medium",
    "traffic": "high",
    "waterlogging": "high",
}

# Route-specific scenario: route_id -> ordered list of (location_name, incident_type)
# Kept for backward compatibility / image source reference, but NOT used to decide incident_type for raw observations
SCENARIOS = {
    "BVR001": [
        ("Bhimavaram", "normal"),
        ("Veeravasaram", "traffic"),
        ("Pennada", "potholes"),
        ("Palakollu Road", "garbage"),
        ("Palakollu", "normal"),
    ],
    "BVR002": [
        ("Bhimavaram", "normal"),
        ("Undi", "pedestrian"),
        ("Attili", "waterlogging"),
        ("Pentapadu", "illegal parking"),
        ("Tadepalligudem", "normal"),
    ],
    "BVR003": [
        ("Bhimavaram", "normal"),
        ("Veeravasaram", "traffic"),
        ("Mogalthur Road", "potholes"),
        ("Narsapur Road", "garbage"),
        ("Narasapur", "normal"),
    ],
}

# Only simulate these 3 buses as per goal
SIM_BUSES = [
    {"bus_id": "BVR-101", "route_id": "BVR001"},
    {"bus_id": "BVR-102", "route_id": "BVR002"},
    {"bus_id": "BVR-103", "route_id": "BVR003"},
]

# Tracks current waypoint index per bus for API trigger inspection
CURRENT_POSITIONS = {b["bus_id"]: 0 for b in SIM_BUSES}

# Raw camera observations: bus_id -> latest observation dict
LATEST_OBSERVATIONS = {}


def load_routes():
    """Load routes from routes.json. Returns dict route_id -> waypoints list."""
    if not ROUTES_FILE.exists():
        print(f"[WARN] {ROUTES_FILE} not found, using SCENARIOS as fallback")
        return {rid: [loc for loc, _ in pts] for rid, pts in SCENARIOS.items()}
    try:
        with open(ROUTES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        routes = {}
        for r in data.get("routes", []):
            rid = r.get("route_id")
            wps = r.get("waypoints", [])
            normalized = []
            for wp in wps:
                if isinstance(wp, str):
                    normalized.append(wp)
                elif isinstance(wp, dict):
                    normalized.append(wp.get("name", str(wp)))
                else:
                    normalized.append(str(wp))
            routes[rid] = normalized
        return routes
    except Exception as e:
        print(f"[ERROR] load_routes failed: {e}")
        return {rid: [loc for loc, _ in pts] for rid, pts in SCENARIOS.items()}


def find_image(incident_type):
    """
    Legacy helper - kept for compatibility. Not used for raw observations.
    Dynamically scan images/<incident_type>/ for files.
    Returns (image_path_str_or_None, actual_type_used)
    """
    folder = IMAGES_DIR / incident_type
    files = []
    if folder.exists():
        for p in folder.rglob("*"):
            if p.is_file() and p.name != ".gitkeep" and not p.name.startswith("."):
                if p.suffix.lower() in [".jpg", ".jpeg", ".png", ".mov", ".mp4", ".avi", ".webp"]:
                    files.append(p)
    if files:
        chosen = random.choice(files)
        try:
            rel = chosen.relative_to(ROOT).as_posix()
        except ValueError:
            rel = str(chosen).replace("\\", "/")
        return rel, incident_type
    if incident_type != "normal":
        normal_folder = IMAGES_DIR / "normal"
        normal_files = []
        if normal_folder.exists():
            for p in normal_folder.rglob("*"):
                if p.is_file() and p.name != ".gitkeep" and p.suffix.lower() in [".jpg", ".jpeg", ".png", ".mov", ".mp4", ".avi", ".webp"]:
                    normal_files.append(p)
        if normal_files:
            chosen = random.choice(normal_files)
            try:
                rel = chosen.relative_to(ROOT).as_posix()
            except ValueError:
                rel = str(chosen).replace("\\", "/")
            return rel, "normal"
        return None, "normal"
    else:
        return None, "normal"


def get_mime_type(image_path: Path) -> str:
    ext = image_path.suffix.lower()
    return MIME_MAP.get(ext, mimetypes.guess_type(str(image_path))[0] or "application/octet-stream")


def verify_image_file(image_path: Path) -> bool:
    """Verify file exists, size>0, and is a valid image (if Pillow available)."""
    if not image_path.is_file():
        print(f"[IMAGE] Invalid: not a file -> {image_path}")
        return False
    size = image_path.stat().st_size
    if size == 0:
        print(f"[IMAGE] Invalid: empty file -> {image_path}")
        return False
    mime = get_mime_type(image_path)
    print(f"[IMAGE] Selected: {image_path}")
    print(f"[IMAGE] Filename: {image_path.name}")
    print(f"[IMAGE] Size: {size} bytes ({size/1024:.1f} KB)")
    print(f"[IMAGE] MIME: {mime}")
    if HAS_PILLOW:
        try:
            with PILImage.open(image_path) as im:
                im.verify()
            # verify() closes image, reopen to get size
            with PILImage.open(image_path) as im2:
                w, h = im2.size
                fmt = im2.format
            print(f"[IMAGE] Valid image")
            print(f"[IMAGE] Resolution: {w}x{h}")
            print(f"[IMAGE] Format: {fmt}")
            print(f"[IMAGE] Size: {size/1024:.1f} KB")
        except Exception as e:
            print(f"[IMAGE] Invalid image (Pillow verify failed): {e}")
            return False
    else:
        print(f"[IMAGE] Valid image (Pillow not installed, basic checks passed)")
        print(f"[IMAGE] Size: {size/1024:.1f} KB")
    return True


# Road-condition scope: simulator must generate only these 3 categories
ALLOWED_SIM_CATEGORIES = ["pothole", "damaged_road", "waterlogging"]
ALLOWED_SIM_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

# Sequential image pool — deterministic, no random
_IMAGE_POOL: list[Path] = []
_IMAGE_INDEX: int = 0
_POOL_LOCK = None  # lazy threading.Lock

def _get_pool_lock():
    global _POOL_LOCK
    if _POOL_LOCK is None:
        import threading
        _POOL_LOCK = threading.Lock()
    return _POOL_LOCK

def _build_image_pool() -> list[Path]:
    pool: list[Path] = []
    if not IMAGES_DIR.exists():
        return pool
    for cat in ALLOWED_SIM_CATEGORIES:
        cat_dir = IMAGES_DIR / cat
        if not cat_dir.exists():
            continue
        files = []
        for p in cat_dir.rglob("*"):
            if not p.is_file():
                continue
            if p.name == ".gitkeep" or p.name.startswith("."):
                continue
            ext = p.suffix.lower()
            if ext not in ALLOWED_SIM_IMAGE_EXTS:
                continue
            try:
                if p.stat().st_size == 0:
                    continue
            except:
                continue
            # quick Pillow verify not done here — done at send time
            # store relative sort key
            files.append(p)
        files.sort(key=lambda x: x.relative_to(cat_dir).as_posix().lower())
        pool.extend(files)
    # final deterministic sort is category order + filename order (already)
    return pool

def get_image_pool() -> list[Path]:
    global _IMAGE_POOL
    if not _IMAGE_POOL:
        _IMAGE_POOL = _build_image_pool()
    return _IMAGE_POOL

def _image_category(p: Path) -> str:
    try:
        rel = p.relative_to(IMAGES_DIR)
        return rel.parts[0] if rel.parts else "unknown"
    except:
        return "unknown"

def get_sequential_media() -> Path | None:
    """Deterministic sequential selection — cycles through all valid images."""
    pool = get_image_pool()
    if not pool:
        print("[MEDIA] No valid media found under images/ (pothole/damaged_road/waterlogging)")
        return None
    lock = _get_pool_lock()
    with lock:
        global _IMAGE_INDEX
        idx = _IMAGE_INDEX % len(pool)
        chosen = pool[idx]
        _IMAGE_INDEX = (_IMAGE_INDEX + 1) % len(pool)
    # validate still exists
    if not chosen.is_file() or chosen.stat().st_size == 0:
        print(f"[MEDIA] Chosen file invalid at index {idx}: {chosen}")
        return get_sequential_media() if len(pool) > 1 else None
    mime = get_mime_type(chosen)
    size = chosen.stat().st_size
    print(f"[IMAGE] Sequential selected [{idx+1}/{len(pool)}]: {chosen}")
    print(f"[IMAGE] Category: {_image_category(chosen)} | Filename: {chosen.name} | Size: {size} bytes | MIME: {mime}")
    return chosen

def get_status_info() -> dict:
    """For simulator_server: current/next image info without advancing."""
    pool = get_image_pool()
    lock = _get_pool_lock()
    with lock:
        idx = _IMAGE_INDEX % len(pool) if pool else 0
    total = len(pool)
    current = pool[(idx - 1) % total] if total and _IMAGE_INDEX > 0 else None
    nxt = pool[idx] if total else None
    def rel(p): 
        try: return p.relative_to(ROOT).as_posix()
        except: return str(p)
    def rel2(p):
        try: return p.relative_to(IMAGES_DIR).as_posix()
        except: return str(p)
    return {
        "total_images": total,
        "image_index": _IMAGE_INDEX % total if total else 0,
        "raw_index": _IMAGE_INDEX,
        "current_image": rel(current) if current else None,
        "current_rel": rel2(current) if current else None,
        "category": _image_category(current) if current else None,
        "next_image": rel(nxt) if nxt else None,
        "next_rel": rel2(nxt) if nxt else None,
        "next_category": _image_category(nxt) if nxt else None,
    }

def reset_image_pool():
    global _IMAGE_POOL, _IMAGE_INDEX
    lock = _get_pool_lock()
    with lock:
        _IMAGE_POOL = _build_image_pool()
        _IMAGE_INDEX = 0

# Backward compat: keep old name but make it sequential
def select_random_media():
    """Deprecated random — now delegates to sequential for deterministic cycling."""
    return get_sequential_media()


def select_random_image():
    """Backward compat alias - now delegates to select_random_media."""
    return select_random_media()


def create_incident_payload(bus_id, route_id, location_name, latitude, longitude, incident_type, image_path):
    """
    Legacy - kept for compatibility. Not used for raw observation pipeline.
    """
    title = TITLE_MAPPING.get(incident_type, f"{incident_type} detected")
    severity = SEVERITY_MAPPING.get(incident_type, "medium")
    speed_kmh = round(random.uniform(15, 40), 1)
    vehicle_count = random.randint(10, 80)
    if vehicle_count <= 25:
        congestion_level = "low"
    elif vehicle_count <= 50:
        congestion_level = "medium"
    else:
        congestion_level = "high"
    occurred_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    description = f"{title} at {location_name} observed by {bus_id} on route {route_id}."
    payload = {
        "incident_type": incident_type,
        "title": title,
        "latitude": latitude,
        "longitude": longitude,
        "description": description,
        "severity": severity,
        "status": "reported",
        "location_name": location_name,
        "address": f"{location_name}, Bhimavaram, Andhra Pradesh",
        "bus_id": bus_id,
        "route_id": route_id,
        "created_by": "bus_simulator",
        "speed_kmh": speed_kmh,
        "vehicle_count": vehicle_count,
        "congestion_level": congestion_level,
        "occurred_at": occurred_at,
        "metadata_json": {
            "image_path": image_path,
            "source": "bus_camera_simulator"
        }
    }
    return payload


def send_to_backend(payload):
    """Legacy incident POST - kept for compatibility."""
    if not API_ENDPOINT:
        print(f"[API] API_ENDPOINT not configured, skipping POST")
        return False
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(API_ENDPOINT, data=data, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            print(f"API: POST {API_ENDPOINT}")
            print(f"Response status: {resp.status}")
            if body:
                print(f"Response body: {body[:300]}")
            return True
    except urllib.error.HTTPError as e:
        print("API ERROR - backend unavailable")
        print(f"[API ERROR] HTTP {e.code} - {e.read().decode(errors='ignore')[:300]}")
    except urllib.error.URLError as e:
        print("API ERROR - backend unavailable")
        print(f"[API ERROR] Connection failed to {API_ENDPOINT}: {e.reason}")
    except Exception as e:
        print("API ERROR - backend unavailable")
        print(f"[API ERROR] {e}")
    return False


def create_raw_observation(bus_id, route_id, location_name, latitude, longitude, image_path: Path):
    """
    Create RAW CAMERA OBSERVATION - no AI analysis.
    Returns dict with bus/location metadata + image path (absolute).
    """
    occurred_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "bus_id": bus_id,
        "route_id": route_id,
        "latitude": latitude,
        "longitude": longitude,
        "location_name": location_name,
        "occurred_at": occurred_at,
        "image_path": image_path,  # absolute Path or None
    }


def send_camera_observation(observation):
    """
    Send raw camera observation as multipart/form-data to BUS_OBSERVATION_ENDPOINT.
    Fields: bus_id, route_id, latitude, longitude, location_name, occurred_at, image
    Image file is sent as binary via requests with context manager.
    """
    if not BUS_OBSERVATION_ENDPOINT:
        print("[API] BUS_OBSERVATION_ENDPOINT not configured")
        return False

    image_path = observation.get("image_path")
    if image_path is None:
        print(f"API ERROR - image_path is None for {observation.get('bus_id')}")
        return False
    image_path = Path(image_path)

    # Resolve: verify exists and size >0
    if not os.path.isfile(str(image_path)):
        print(f"API ERROR - image not found for {observation.get('bus_id')} at {observation.get('location_name')}: {image_path}")
        return False
    if os.path.getsize(str(image_path)) == 0:
        print(f"API ERROR - image is empty: {image_path}")
        return False

    # Verify extension allowed (images + videos)
    ext = image_path.suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTS:
        print(f"API ERROR - skipping unsupported file (extension {ext}): {image_path}")
        return False

    # Verify media before upload: images via Pillow, videos via basic size check
    if ext in ALLOWED_IMAGE_EXTS:
        if not verify_image_file(image_path):
            print(f"API ERROR - image verification failed, not uploading: {image_path}")
            return False
    else:
        # video: basic existence + non-empty already checked; skip Pillow verify
        print(f"[VIDEO] Valid video: {image_path.name} ({image_path.stat().st_size/1024:.1f} KB)")

    # Determine MIME
    mime_type = get_mime_type(image_path)
    filename = image_path.name
    file_size = image_path.stat().st_size

    print("=" * 50)
    print("[UPLOAD] Sending observation")
    print(f"Bus: {observation.get('bus_id')}")
    print(f"Route: {observation.get('route_id')}")
    print(f"Location: {observation.get('location_name')}")
    print(f"Image: {filename}")
    try:
        rel = image_path.relative_to(ROOT).as_posix()
    except:
        rel = str(image_path)
    print(f"Local path: {rel}")
    print(f"Image size: {file_size} bytes")
    print(f"MIME: {mime_type}")
    print(f"Endpoint: {BUS_OBSERVATION_ENDPOINT}")
    print("=" * 50)

    data = {
        "bus_id": str(observation.get("bus_id", "")),
        "route_id": str(observation.get("route_id", "")),
        "latitude": str(observation.get("latitude", "")),
        "longitude": str(observation.get("longitude", "")),
        "location_name": str(observation.get("location_name", "")),
        "occurred_at": str(observation.get("occurred_at", "")),
    }

    try:
        with open(image_path, "rb") as image_file:
            files = {
                "image": (filename, image_file, mime_type)
            }
            response = requests.post(
                BUS_OBSERVATION_ENDPOINT,
                data=data,
                files=files,
                timeout=30
            )
            print(f"[UPLOAD] HTTP {response.status_code}")
            try:
                body = response.json()
                print(f"[UPLOAD] Response: {json.dumps(body)[:800]}")
                if body.get("image_saved") is True:
                    print(f"[UPLOAD] Backend image_saved = true")
                if body.get("id"):
                    print(f"[UPLOAD] Observation ID = {body.get('id')}")
                if body.get("image_path"):
                    print(f"[UPLOAD] Saved path = {body.get('image_path')}")
                if body.get("image_size"):
                    print(f"[UPLOAD] Saved size = {body.get('image_size')} bytes")
            except:
                print(f"[UPLOAD] Response body: {response.text[:500]}")
            if response.status_code in (200, 201):
                return True
            else:
                print(f"[UPLOAD] Failed with status {response.status_code}")
                return False
    except requests.exceptions.RequestException as e:
        print("API ERROR - backend unavailable")
        print(f"[API ERROR] Request failed: {e}")
    except Exception as e:
        print("API ERROR - backend unavailable")
        print(f"[API ERROR] {e}")
    return False


def simulate_bus(bus_id, route_id, step_index):
    """
    Simulate one bus at a specific route point index.
    RAW OBSERVATION MODE: no AI, no incident_type decision.
    Selects a random image, creates raw observation, updates LATEST_OBSERVATIONS.
    """
    # Get location from SCENARIOS waypoint (for GPS only, not for classification)
    scenario = SCENARIOS.get(route_id, [])
    if scenario:
        idx = step_index % len(scenario)
        location_name = scenario[idx][0]
    else:
        # fallback to BUS_ROUTES waypoints
        location_name = "Bhimavaram"
    lat, lon = GPS_COORDS.get(location_name, (16.5449, 81.5212))

    # Select random media (image or video) regardless of location / folder name
    image_path = select_random_media()

    # Create raw observation
    observation = create_raw_observation(bus_id, route_id, location_name, lat, lon, image_path)
    # Update latest
    LATEST_OBSERVATIONS[bus_id] = observation

    # Print raw observation (no incident analysis)
    print("=" * 50)
    print("BUS RAW OBSERVATION")
    print("=" * 50)
    print(f"Bus: {bus_id}")
    print(f"Route: {route_id}")
    print(f"Location: {location_name}")
    print(f"GPS: {lat:.5f}, {lon:.5f}")
    if image_path:
        print(f"Image: {image_path.relative_to(ROOT).as_posix() if image_path.is_relative_to(ROOT) else str(image_path)}")
        print(f"Image size: {image_path.stat().st_size} bytes")
    else:
        print("Image: (no image available)")
    print(f"Timestamp: {observation['occurred_at']}")
    print("Mode: raw camera - no AI analysis")
    print("=" * 50)
    print()

    return observation


def trigger_backend_api():
    """
    Every API_TRIGGER_INTERVAL seconds, send latest RAW observations for all buses.
    Normal images ARE ALSO SENT - no skipping.
    """
    print("=" * 50)
    print("API TRIGGER")
    print("=" * 50)
    print("Sending current bus raw observations to backend")
    print(f"Trigger interval: {API_TRIGGER_INTERVAL} seconds")
    print(f"Endpoint: {BUS_OBSERVATION_ENDPOINT}")
    print("=" * 50)

    if not LATEST_OBSERVATIONS:
        print("No observations yet - skipping trigger")
        print("=" * 50)
        print("API TRIGGER COMPLETE")
        print("=" * 50)
        print()
        return

    for bus in SIM_BUSES:
        bus_id = bus["bus_id"]
        observation = LATEST_OBSERVATIONS.get(bus_id)
        if not observation:
            print(f"Skipping {bus_id} - no observation yet")
            continue

        location_name = observation.get("location_name")
        image_path = observation.get("image_path")
        print(f"Sending {bus_id} / {observation.get('route_id')} / {location_name}")
        if image_path:
            try:
                rel = image_path.relative_to(ROOT).as_posix()
            except:
                rel = str(image_path)
            print(f"Image: {rel}")
        print(f"API: POST {BUS_OBSERVATION_ENDPOINT}")
        success = send_camera_observation(observation)
        if not success:
            # already printed API ERROR
            pass

    print("=" * 50)
    print("API TRIGGER COMPLETE")
    print("=" * 50)
    print()


def run_simulation(cycles=None, interval=SIMULATION_INTERVAL):
    """
    Every `interval` seconds, advance each bus to next route point.
    Every API_TRIGGER_INTERVAL seconds, trigger backend API.
    cycles: for testing, number of intervals (3-sec ticks). None = infinite until Ctrl+C
    """
    load_routes()  # validate

    # Startup banner
    print("=" * 50)
    print("BHIMAVARAM BUS SIMULATOR - RAW CAMERA MODE")
    print("=" * 50)
    print(f"Bus movement interval: {interval} seconds")
    print(f"Backend API interval: 8 minutes ({API_TRIGGER_INTERVAL} seconds)")
    print(f"Backend endpoint: {BUS_OBSERVATION_ENDPOINT}")
    print(f"Buses: {', '.join([b['bus_id'] for b in SIM_BUSES])}")
    print("Mode: raw image + GPS + metadata (no AI)")
    print("=" * 50)
    print()

    # Initialize positions
    global CURRENT_POSITIONS
    CURRENT_POSITIONS = {b["bus_id"]: 0 for b in SIM_BUSES}
    positions = {b["bus_id"]: 0 for b in SIM_BUSES}

    last_api_trigger = time.time()
    cycle = 0
    try:
        while True:
            # Every 3 seconds: simulate all buses (raw observations)
            for bus in SIM_BUSES:
                bus_id = bus["bus_id"]
                route_id = bus["route_id"]
                idx = positions[bus_id]
                simulate_bus(bus_id, route_id, idx)
                CURRENT_POSITIONS[bus_id] = idx
                scenario_len = len(SCENARIOS.get(route_id, [])) or 5
                positions[bus_id] = (idx + 1) % scenario_len

            cycle += 1
            if cycles is not None and cycle >= cycles:
                break

            now = time.time()
            elapsed = now - last_api_trigger
            if elapsed >= API_TRIGGER_INTERVAL:
                trigger_backend_api()
                last_api_trigger = time.time()

            time.sleep(interval)
    except KeyboardInterrupt:
        print("Bus simulator stopped.")


if __name__ == "__main__":
    run_simulation()
