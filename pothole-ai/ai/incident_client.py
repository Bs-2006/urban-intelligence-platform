"""
Incident client - prepares payload and optionally sends to friend's API.
Adapter/configurable: INCIDENTS_API_URL, INCIDENTS_API_KEY, INCIDENTS_API_HEADERS
If INCIDENTS_API_URL is empty, payload is prepared/logged but not sent.
Do NOT invent friend's API endpoint or PostgreSQL schema.
"""
import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

INCIDENTS_API_URL = os.getenv("INCIDENTS_API_URL", "http://localhost:8000/api/ai/incidents")
INCIDENTS_API_KEY = os.getenv("INCIDENTS_API_KEY", "")
INCIDENTS_API_HEADERS_JSON = os.getenv("INCIDENTS_API_HEADERS", "")
OBSERVATION_STATUS_API_URL = os.getenv("OBSERVATION_STATUS_API_URL", "http://localhost:8000/api/ai/observation-status")
OBSERVATION_STATUS_API_KEY = os.getenv("OBSERVATION_STATUS_API_KEY", "")


INCIDENT_TITLES = {
    "potholes": "Pothole detected",
    "road_damage": "Road damage detected",
    "garbage": "Garbage detected",
    "traffic": "Traffic analysis",
    "waterlogging": "Waterlogging detected",
    "road_sign": "Road sign detected",
    "zebra_crossing": "Zebra crossing detected",
    "illegal_parking": "Illegal parking detected",
    "accident": "Accident detected",
    "pedestrian": "Pedestrian detected",
}
INCIDENT_DESCRIPTIONS = {
    "potholes": "AI detected a pothole in the submitted media.",
    "road_damage": "AI detected road damage (crack/pothole) in the submitted media.",
    "garbage": "AI detected garbage/waste in the submitted media.",
    "traffic": "AI traffic analysis: vehicle/pedestrian count.",
    "waterlogging": "AI detected waterlogging in the submitted media.",
    "road_sign": "AI detected road sign/divider.",
    "zebra_crossing": "AI detected zebra crossing.",
    "illegal_parking": "AI detected illegal parking.",
    "accident": "AI detected accident.",
    "pedestrian": "AI detected pedestrian(s).",
}

def build_incident_payload(
    confidence: float,
    detections: list,
    model: str,
    observation: Optional[Dict[str, Any]] = None,
    source: str = "manual",
    filename: str = None,
    annotated_image_url: Optional[str] = None,
    annotated_image_path: Optional[str] = None,
    frame_metadata: Optional[Dict[str, Any]] = None,
    media_type: str = "image",
    # Manual upload browser location/time (source=manual). For simulator observations these are ignored.
    manual_latitude: Optional[float] = None,
    manual_longitude: Optional[float] = None,
    manual_location_name: Optional[str] = None,
    manual_address: Optional[str] = None,
    manual_occurred_at: Optional[str] = None,
    manual_created_at: Optional[str] = None,
    manual_updated_at: Optional[str] = None,
    incident_type: str = "potholes",
    detected_class: Optional[str] = None,
    vehicle_count: Optional[int] = None,
    pedestrian_count: Optional[int] = None,
    congestion_level: Optional[str] = None,
    extra_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build incident payload matching spec section 4.
    Supports generic incident_type for multi-defect.
    TWO PATHS:
    - observation is not None => BUS SIMULATOR OBSERVATION: preserve simulator metadata exactly (bus_id/route_id/lat/lng/location_name/occurred_at). Never use AI/browser location.
    - observation is None => MANUAL FRONTEND UPLOAD: use browser current geolocation/timestamp passed via manual_*; if unavailable keep null; demo bus/traffic.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    incident_type = incident_type or "potholes"

    # Extract frame info for metadata_json
    frame_number = None
    video_timestamp = None
    if frame_metadata:
        frame_number = frame_metadata.get("frame_number")
        video_timestamp = frame_metadata.get("video_timestamp")

    metadata_json = {
        "model": model or "EngJamesO/pothole-detector",
        "media_type": media_type,
        "confidence": confidence,
        "detections": detections or [],
        "frame_number": frame_number,
        "video_timestamp": video_timestamp,
        "annotated_image_url": annotated_image_url,
        "annotated_image_path": annotated_image_path,
    }
    if detected_class:
        metadata_json["detected_class"] = detected_class
    if vehicle_count is not None:
        metadata_json["vehicle_count"] = vehicle_count
    if pedestrian_count is not None:
        metadata_json["pedestrian_count"] = pedestrian_count
    if extra_metadata:
        metadata_json.update(extra_metadata)

    title = INCIDENT_TITLES.get(incident_type, f"{incident_type} detected")
    # For road_damage include class in title if available
    if incident_type == "road_damage" and detected_class and detected_class != "pothole":
        title = f"Road damage: {detected_class.replace('_',' ')}"
    if incident_type == "garbage" and detected_class:
        title = f"Garbage: {detected_class}"
    description = INCIDENT_DESCRIPTIONS.get(incident_type, f"AI detected {incident_type}.")

    if observation:
        # BUS SIMULATOR OBSERVATION - preserve simulator metadata exactly, do NOT use browser/AI location
        # For traffic, keep simulator vehicle counts unless AI provides counts – AI counts stored in metadata only
        payload = {
            "incident_type": incident_type,
            "title": title,
            "description": description,
            "severity": "medium",
            "status": "open",
            "latitude": observation.get("latitude"),
            "longitude": observation.get("longitude"),
            "created_at": now,
            "location_name": observation.get("location_name"),
            "address": observation.get("address") if observation.get("address") else (f"{observation.get('location_name')}, Bhimavaram, Andhra Pradesh" if observation.get("location_name") else None),
            "bus_id": observation.get("bus_id"),
            "route_id": observation.get("route_id"),
            "created_by": "AI",
            "speed_kmh": observation.get("speed_kmh"),
            "vehicle_count": observation.get("vehicle_count") if vehicle_count is None else vehicle_count,
            "congestion_level": observation.get("congestion_level") if congestion_level is None else congestion_level,
            "occurred_at": observation.get("occurred_at") or now,
            "updated_at": now,
            "metadata_json": {
                **metadata_json,
                "observation_id": observation.get("id"),
                "original_image_path": observation.get("image_path"),
                "original_image_url": observation.get("image_url"),
                "source": source,
                "filename": filename,
            },
        }
    else:
        # MANUAL FRONTEND UPLOAD (TESTING/DEMO) - use browser current GPS + current timestamp
        # + demo bus/traffic values. Simulator observations are untouched (observation path above).
        lat = manual_latitude
        lng = manual_longitude
        # Validate they are numbers; otherwise keep null (permission denied/unavailable)
        try:
            lat = float(lat) if lat is not None else None
        except:
            lat = None
        try:
            lng = float(lng) if lng is not None else None
        except:
            lng = None
        occurred = manual_occurred_at or now
        created = manual_created_at or now
        updated = manual_updated_at or now
        # No reverse geocoding: use generic demo location labels, never invent street address
        # If frontend explicitly sent location_name/address keep it, otherwise default to demo labels
        loc_name = manual_location_name if manual_location_name not in (None, "") else "Current Browser Location"
        addr = manual_address if manual_address not in (None, "") else "Not available"

        # Demo traffic values: for non-traffic incidents keep 35/12/medium;
        # for traffic incidents use actual detected counts if provided
        demo_speed = 35
        demo_vehicle = vehicle_count if (incident_type == "traffic" and vehicle_count is not None) else 12
        demo_congestion = congestion_level if congestion_level else "medium"

        payload = {
            "incident_type": incident_type,
            "title": title,
            "description": description,
            "severity": "medium",
            "status": "open",
            "latitude": lat,
            "longitude": lng,
            "created_at": created,
            "location_name": loc_name,
            "address": addr,
            "bus_id": "DEMO-BUS-001",
            "route_id": "DEMO-ROUTE-001",
            "created_by": "AI",
            "speed_kmh": demo_speed,
            "vehicle_count": demo_vehicle,
            "congestion_level": demo_congestion,
            "occurred_at": occurred,
            "updated_at": updated,
            "metadata_json": {
                **metadata_json,
                "source": source,
                "filename": filename,
            },
        }
    return payload


def _build_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if INCIDENTS_API_KEY:
        headers["Authorization"] = f"Bearer {INCIDENTS_API_KEY}"
    if INCIDENTS_API_HEADERS_JSON:
        try:
            extra = json.loads(INCIDENTS_API_HEADERS_JSON)
            if isinstance(extra, dict):
                headers.update(extra)
        except Exception as e:
            print(f"[INCIDENT] Failed to parse INCIDENTS_API_HEADERS: {e}")
    return headers


def build_observation_status(
    observation: Dict[str, Any],
    media_type: str = "image",
    all_model_results: Optional[Dict[str, Any]] = None,
    source: str = "bus_simulator",
) -> Dict[str, Any]:
    """Build clean observation status payload preserving simulator metadata exactly."""
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "observation_id": observation.get("id"),
        "status": "clear",
        "detected": False,
        "latitude": observation.get("latitude"),
        "longitude": observation.get("longitude"),
        "bus_id": observation.get("bus_id"),
        "route_id": observation.get("route_id"),
        "occurred_at": observation.get("occurred_at"),
        "analyzed_at": now,
        "media_type": media_type,
        "source": source,
        "metadata_json": {
            "all_model_results": all_model_results or {},
        },
    }

def send_observation_status(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = os.getenv("OBSERVATION_STATUS_API_URL", OBSERVATION_STATUS_API_URL)
    if not url or url.strip() == "":
        print("[OBS_STATUS] Observation status API not configured (OBSERVATION_STATUS_API_URL empty).")
        print("[OBS_STATUS] Clean observation status prepared but not sent - stored locally.")
        print(f"[OBS_STATUS] Payload: {json.dumps(payload, indent=2)}")
        return {"sent": False, "reason": "not_configured", "payload": payload}
    import requests
    try:
        headers = _build_headers()
        # allow separate key for observation status if provided
        status_key = os.getenv("OBSERVATION_STATUS_API_KEY", OBSERVATION_STATUS_API_KEY)
        if status_key:
            headers["Authorization"] = f"Bearer {status_key}"
        print(f"[OBS_STATUS] Sending to {url}")
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"[OBS_STATUS] Response {resp.status_code}: {resp.text[:500]}")
        return {"sent": True, "status_code": resp.status_code, "response": resp.text[:1000], "payload": payload}
    except Exception as e:
        print(f"[OBS_STATUS] Failed to send: {e}")
        return {"sent": False, "error": str(e), "payload": payload}

def send_incident(payload: Dict[str, Any]) -> Dict[str, Any]:
    url = os.getenv("INCIDENTS_API_URL", INCIDENTS_API_URL)
    if not url or url.strip() == "":
        print("[INCIDENT] Incidents API not configured (INCIDENTS_API_URL empty).")
        print("[INCIDENT] Pothole incident payload prepared but not sent - wire friend's API later.")
        print(f"[INCIDENT] Payload: {json.dumps(payload, indent=2)}")
        return {"sent": False, "reason": "not_configured", "payload": payload}
    import requests
    try:
        headers = _build_headers()
        print(f"[INCIDENT] Sending to {url}")
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"[INCIDENT] Response {resp.status_code}: {resp.text[:500]}")
        return {"sent": True, "status_code": resp.status_code, "response": resp.text[:1000], "payload": payload}
    except Exception as e:
        print(f"[INCIDENT] Failed to send: {e}")
        return {"sent": False, "error": str(e), "payload": payload}
