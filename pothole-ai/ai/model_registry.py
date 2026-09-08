"""
Multi-defect Urban Intelligence model registry.
Preserves EngJamesO/pothole-detector as dedicated pothole model.
Adds road_damage, garbage, traffic, and disabled adapters for future types.
Lazy loading via get_model() in multi_detector.py – registry only holds config.
"""
import os

# Road-condition scope: pothole, damaged_road, waterlogging — all three real HF models
_DEFAULT_ENABLED = {"potholes", "road_damage", "waterlogging"}

_env_enabled = os.getenv("ENABLED_MODELS", "")
if _env_enabled.strip():
    ENABLED_MODELS = {x.strip() for x in _env_enabled.split(",") if x.strip()}
else:
    ENABLED_MODELS = _DEFAULT_ENABLED

MODEL_REGISTRY = {
    "potholes": {
        "name": "pothole",
        "hf_model_id": "EngJamesO/pothole-detector",
        "model_type": "yolo",
        "incident_types": ["potholes"],
        "enabled": "potholes" in ENABLED_MODELS,
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_POTHOLE", os.getenv("CONFIDENCE_THRESHOLD", "0.50"))),
        "description": "Dedicated YOLO pothole detector",
    },
    "road_damage": {
        "name": "road_damage",
        "hf_model_id": "cvtechniques/road-damage-detection-yolov11",
        "model_type": "yolo",
        "incident_types": ["road_damage"],
        "enabled": "road_damage" in ENABLED_MODELS,
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_ROAD_DAMAGE", "0.35")),
        "description": "YOLOv11s road-surface-damage detector (alligator/longitudinal/transverse cracks + potholes)",
    },
    "garbage": {
        "name": "garbage",
        "hf_model_id": "HrutikAdsare/waste-detection-yolov8",
        "model_type": "yolo",
        "incident_types": ["garbage"],
        "enabled": "garbage" in ENABLED_MODELS,
        "confidence_threshold": float(os.getenv("GARBAGE_CONFIDENCE_THRESHOLD", os.getenv("CONFIDENCE_THRESHOLD_GARBAGE", "0.50"))),
        "description": "YOLOv8 waste detection (cardboard, e-waste, glass, medical, metal, organic, paper, plastic)",
    },
    "traffic": {
        "name": "traffic",
        "hf_model_id": "abrarhameem398/traffice-detection-best",
        "model_type": "yolo",
        "incident_types": ["traffic"],
        "enabled": "traffic" in ENABLED_MODELS,
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_TRAFFIC", "0.40")),
        "description": "Vehicle + pedestrian detection / counting",
    },
    "road_sign": {
        "name": "road_sign",
        "hf_model_id": "dima806/traffic_sign_detection",
        "model_type": "yolo",
        "incident_types": ["road_sign", "zebra_crossing", "road_divider"],
        "enabled": False,  # per spec: disabled until inspected/tested – class mapping unverified
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_ROAD_SIGN", "0.40")),
        "description": "Traffic sign / road divider / zebra crossing – DISABLED pending validation",
    },
    "zebra_crossing": {
        "name": "zebra_crossing",
        "hf_model_id": "dima806/traffic_sign_detection",
        "model_type": "yolo",
        "incident_types": ["zebra_crossing"],
        "enabled": False,
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_ZEBRA", "0.40")),
        "description": "Zebra crossing via traffic_sign_detection – DISABLED pending validation",
        "shared_model": "road_sign",
    },
    "waterlogging": {
        "name": "waterlogging",
        "hf_model_id": "openai/clip-vit-base-patch32",
        "model_type": "clip",
        "incident_types": ["waterlogging"],
        "enabled": "waterlogging" in ENABLED_MODELS,
        "confidence_threshold": float(os.getenv("CONFIDENCE_THRESHOLD_WATER", os.getenv("WATERLOGGING_THRESHOLD", "0.45"))),
        "description": "CLIP zero-shot waterlogging detector (openai/clip-vit-base-patch32) — RGB bus-camera images",
    },
    "illegal_parking": {
        "name": "illegal_parking",
        "hf_model_id": "",
        "model_type": "yolo",
        "incident_types": ["illegal_parking"],
        "enabled": False,
        "confidence_threshold": 0.50,
        "description": "Illegal parking – placeholder adapter",
    },
    "accident": {
        "name": "accident",
        "hf_model_id": "",
        "model_type": "yolo",
        "incident_types": ["accident"],
        "enabled": False,
        "confidence_threshold": 0.50,
        "description": "Accident detection – placeholder adapter",
    },
    "pedestrian": {
        "name": "pedestrian",
        "hf_model_id": "abrarhameem398/traffice-detection-best",
        "model_type": "yolo",
        "incident_types": ["pedestrian"],
        "enabled": False,  # pedestrian counting is via traffic model; separate incident disabled
        "confidence_threshold": 0.40,
        "description": "Pedestrian via traffic model – disabled as standalone incident",
        "shared_model": "traffic",
    },
    "license_plate": {
        "name": "license_plate",
        "hf_model_id": "keremberke/yolov5n-license-plate",
        "model_type": "yolo",
        "incident_types": ["vehicle_security"],
        "enabled": True,
        "confidence_threshold": float(os.getenv("PLATE_CONF_THRESHOLD", "0.35")),
        "description": "YOLOv5n license plate detector (keremberke) + PaddleOCR/EasyOCR for ANPR",
    },
}

def get_model_info(key: str):
    return MODEL_REGISTRY.get(key)

def list_models():
    # Return registry with enabled status for /api/models
    return MODEL_REGISTRY

def enabled_models():
    return {k: v for k, v in MODEL_REGISTRY.items() if v.get("enabled") and v.get("hf_model_id")}

# Back-compat: original HF_MODEL_ID
try:
    HF_MODEL_ID = MODEL_REGISTRY["potholes"]["hf_model_id"]
except:
    HF_MODEL_ID = "EngJamesO/pothole-detector"
