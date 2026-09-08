"""
Multi-defect detector: lazy YOLO loader + per-model inference helpers.
Works with MODEL_REGISTRY (model_registry.py). Never crashes whole service if one model fails.
Preserves EngJamesO/pothole-detector as canonical pothole model.
"""
import os
import time
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import cv2

try:
    from model_registry import MODEL_REGISTRY, enabled_models
except ImportError:
    from ai.model_registry import MODEL_REGISTRY, enabled_models

_model_cache = {}  # key -> YOLO model
_seg_cache = {}  # legacy segformer cache (unused, kept for compat)
_clip_cache = {}  # waterlogging CLIP cache: {"processor": ..., "model": ..., "prompts": [...]}

# Traffic heuristics
TRAFFIC_VEHICLE_CLASSES = {"car", "truck", "bus", "motorcycle", "bicycle", "vehicle", "auto"}
TRAFFIC_PEDESTRIAN_CLASSES = {"person", "pedestrian", "people"}

# Garbage class passthrough – any waste class maps to incident_type garbage
# HrutikAdsare model typically has 8 waste classes; we accept any detection.

def _load_yolo(hf_id: str):
    from ultralytics import YOLO
    candidates = [f"hf://{hf_id}", hf_id]
    last_err = None
    for cand in candidates:
        try:
            print(f"[MODEL] Trying YOLO('{cand}')")
            m = YOLO(cand)
            print(f"[MODEL] Loaded via '{cand}'")
            return m
        except Exception as e:
            last_err = e
            print(f"[MODEL] Failed cand {cand}: {e}")
            continue
    # fallback huggingface_hub
    try:
        from huggingface_hub import hf_hub_download, list_repo_files
        files = list_repo_files(hf_id)
        pt_file = next((f for f in files if f.endswith(".pt")), None)
        if not pt_file:
            raise RuntimeError(f"No .pt in {hf_id}")
        local_path = hf_hub_download(repo_id=hf_id, filename=pt_file)
        print(f"[MODEL] Downloaded {pt_file} -> {local_path}")
        from ultralytics import YOLO as Y2
        return Y2(local_path)
    except Exception as e:
        print(f"[MODEL] Fallback failed for {hf_id}: {e}")
        raise last_err or e

def get_model(key: str):
    """Lazy load model for registry key. Returns None if disabled / no hf_id / load failed."""
    cfg = MODEL_REGISTRY.get(key)
    if not cfg or not cfg.get("enabled") or not cfg.get("hf_model_id"):
        return None
    # shared model alias (e.g. pedestrian shares traffic)
    shared = cfg.get("shared_model")
    if shared and shared in _model_cache:
        return _model_cache[shared]
    if shared and shared in MODEL_REGISTRY:
        # load shared instead
        return get_model(shared)
    if key in _model_cache:
        return _model_cache[key]
    hf_id = cfg["hf_model_id"]
    if not hf_id:
        print(f"[MODEL] No hf_model_id for {key} – disabled adapter")
        return None
    try:
        print(f"[MODEL] Loading {key} ({hf_id})")
        m = _load_yolo(hf_id)
        _model_cache[key] = m
        print(f"[MODEL] Loaded {key} classes: {m.names}")
        return m
    except Exception as e:
        print(f"[MODEL] Failed to load {key} ({hf_id}): {e}")
        # Fallback for road_damage: try vinothvikas if cvtechniques not available
        if key == "road_damage" and hf_id == "cvtechniques/road-damage-detection-yolov11":
            fallback = "vinothvikas1987/pothole-detection-yolov8"
            try:
                print(f"[MODEL] Fallback trying {fallback} for road_damage")
                m = _load_yolo(fallback)
                _model_cache[key] = m
                print(f"[MODEL] Fallback loaded {key} via {fallback} classes: {m.names}")
                return m
            except Exception as fe:
                print(f"[MODEL] Fallback also failed: {fe}")
        return None

WATERLOGGING_PROMPTS = [
    "a road with severe waterlogging",
    "a road with standing water",
    "a flooded road",
    "a normal dry road",
]

def _get_water_model():
    """Lazy load CLIP for waterlogging. Returns (processor, model) or None."""
    if "waterlogging" in _clip_cache:
        return _clip_cache["waterlogging"]
    cfg = MODEL_REGISTRY.get("waterlogging")
    if not cfg or not cfg.get("enabled") or not cfg.get("hf_model_id"):
        return None
    try:
        from transformers import CLIPProcessor, CLIPModel
        hf_id = cfg["hf_model_id"]
        print(f"[AI] Loading waterlogging model... ({hf_id})")
        processor = CLIPProcessor.from_pretrained(hf_id)
        model = CLIPModel.from_pretrained(hf_id)
        model.eval()
        _clip_cache["waterlogging"] = (processor, model)
        print(f"[AI] Waterlogging CLIP model loaded ({hf_id})")
        return _clip_cache["waterlogging"]
    except Exception as e:
        print(f"[AI] Failed to load waterlogging model: {e}")
        import traceback; traceback.print_exc()
        return None

def detect_waterlogging(image_path: str) -> dict:
    """
    CLIP zero-shot waterlogging detection.
    Returns {"detected": bool, "water_score": float, "confidence": float, "detections": [], "annotated_path": None, "model": str, "count": 0/1}
    water_score = sum of first 3 prompt probabilities. Threshold from registry (default 0.45).
    No folder/filename heuristics — pure model inference. Zero-shot CLIP classification — no segmentation mask
    """
    tup = _get_water_model()
    if tup is None:
        return {"detected": False, "water_score": 0.0, "confidence": 0.0, "detections": [], "annotated_path": None, "annotated_image_path": None, "model": MODEL_REGISTRY.get("waterlogging",{}).get("hf_model_id",""), "configured": False, "count": 0}
    processor, model = tup
    cfg = MODEL_REGISTRY.get("waterlogging", {})
    thresh = float(cfg.get("confidence_threshold", 0.45))
    hf_id = cfg.get("hf_model_id", "openai/clip-vit-base-patch32")
    try:
        from PIL import Image
        import torch
        import torch.nn.functional as F
        img = Image.open(image_path).convert("RGB")
        inputs = processor(text=WATERLOGGING_PROMPTS, images=img, return_tensors="pt", padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
            logits_per_image = outputs.logits_per_image  # [1, 4]
            probs = F.softmax(logits_per_image, dim=1)[0]  # [4]
            water_score = float(probs[0] + probs[1] + probs[2])
            dry_score = float(probs[3])
        water_score = round(water_score, 4)
        detected = water_score >= thresh
        # per-prompt breakdown for debugging
        prompt_probs = [round(float(p), 4) for p in probs.tolist()]
        return {
            "detected": bool(detected),
            "water_score": water_score,
            "confidence": water_score,
            "dry_score": round(dry_score, 4),
            "prompt_probs": prompt_probs,
            "prompts": WATERLOGGING_PROMPTS,
            "threshold": thresh,
            "detections": [],
            "annotated_path": None,
            "annotated_image_path": None,
            "model": hf_id,
            "configured": True,
            "count": 1 if detected else 0,
            "message": "Waterlogging detected" if detected else "No waterlogging detected",
        }
    except Exception as e:
        print(f"[WATER] inference failed: {e}")
        import traceback; traceback.print_exc()
        return {"detected": False, "water_score": 0.0, "confidence": 0.0, "detections": [], "annotated_path": None, "annotated_image_path": None, "model": hf_id, "configured": True, "count": 0, "error": str(e), "message": "No waterlogging detected"}

def preload_enabled():
    for k, cfg in MODEL_REGISTRY.items():
        if cfg.get("enabled") and cfg.get("hf_model_id") and not cfg.get("shared_model"):
            # waterlogging is segformer, handled separately
            if cfg.get("model_type") == "segmentation":
                _get_water_model()
            else:
                get_model(k)

def _iou(a, b):
    x1 = max(a[0], b[0]); y1 = max(a[1], b[1]); x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
    inter = max(0, x2-x1) * max(0, y2-y1)
    if inter == 0:
        return 0
    area_a = (a[2]-a[0])*(a[3]-a[1]); area_b = (b[2]-b[0])*(b[3]-b[1])
    return inter / (area_a + area_b - inter + 1e-6)

def _deduplicate_potholes(detections: List[Dict], iou_thresh=0.5):
    """Confidence-based dedup: keep highest conf when IoU overlap."""
    if not detections:
        return detections
    detections = sorted(detections, key=lambda x: x["confidence"], reverse=True)
    kept = []
    for d in detections:
        overlap = any(_iou(d["bbox"], k["bbox"]) > iou_thresh for k in kept)
        if not overlap:
            kept.append(d)
    return kept

def _run_yolo(model, image_path: str, threshold: float):
    results = model(image_path, conf=threshold, verbose=False)
    r = results[0]
    out = []
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        classes = r.boxes.cls.cpu().numpy().astype(int)
        names = model.names
        for i in range(len(boxes)):
            cls_id = int(classes[i])
            raw = names.get(cls_id, str(cls_id))
            conf = float(confs[i])
            if conf < threshold:
                continue
            x1, y1, x2, y2 = [float(v) for v in boxes[i]]
            out.append({
                "raw_class": raw,
                "class_id": cls_id,
                "confidence": round(conf, 4),
                "bbox": [round(x1,2), round(y1,2), round(x2,2), round(y2,2)],
            })
    return out, r

# ---------- Per-model wrappers ----------

def detect_pothole_model(image_path: str) -> List[Dict]:
    m = get_model("potholes")
    if m is None:
        return []
    cfg = MODEL_REGISTRY["potholes"]
    dets, _ = _run_yolo(m, image_path, cfg["confidence_threshold"])
    # only pothole
    filtered = []
    for d in dets:
        if "pothole" in str(d["raw_class"]).lower():
            filtered.append({"class": "pothole", "confidence": d["confidence"], "bbox": d["bbox"], "class_id": d["class_id"], "raw_class": d["raw_class"]})
    return filtered

def _normalize_road_class(raw: str) -> str:
    n = str(raw).lower().strip().replace(" ", "_").replace("-", "_")
    if "alligator" in n:
        return "alligator_crack"
    if "longitudinal" in n:
        return "longitudinal_crack"
    if "transverse" in n:
        return "transverse_crack"
    if "pothole" in n:
        return "pothole"
    # RDD variants like D00, D10 etc – keep raw normalized but map known codes if present
    # D00/D10 often longitudinal, D20 alligator – but without assumption keep raw for debugging and treat as crack if contains crack
    if "crack" in n:
        # generic crack -> treat as longitudinal for priority (still road_damage)
        if "alligator" not in n and "transverse" not in n and "longitudinal" not in n:
            return "longitudinal_crack"
        return n
    return n

def detect_road_damage(image_path: str) -> List[Dict]:
    m = get_model("road_damage")
    if m is None:
        return []
    cfg = MODEL_REGISTRY["road_damage"]
    dets, _ = _run_yolo(m, image_path, cfg["confidence_threshold"])
    out = []
    for d in dets:
        raw = str(d["raw_class"])
        name = _normalize_road_class(raw)
        # keep original raw for metadata, but class is normalized
        out.append({"class": name, "confidence": d["confidence"], "bbox": d["bbox"], "class_id": d["class_id"], "raw_class": raw})
    if out:
        print(f"[ROAD_DAMAGE] raw classes: {[x['raw_class']+'->'+x['class'] for x in out]}")
    return out

def detect_garbage(image_path: str) -> List[Dict]:
    m = get_model("garbage")
    if m is None:
        return []
    cfg = MODEL_REGISTRY["garbage"]
    dets, _ = _run_yolo(m, image_path, cfg["confidence_threshold"])
    out = []
    for d in dets:
        # Any waste class maps to garbage incident; preserve detected class
        out.append({"class": str(d["raw_class"]), "confidence": d["confidence"], "bbox": d["bbox"], "class_id": d["class_id"], "raw_class": d["raw_class"]})
    return out

def detect_traffic(image_path: str) -> Dict[str, Any]:
    m = get_model("traffic")
    if m is None:
        return {"detections": [], "vehicle_count": 0, "pedestrian_count": 0}
    cfg = MODEL_REGISTRY["traffic"]
    dets, _ = _run_yolo(m, image_path, cfg["confidence_threshold"])
    vehicles = 0
    pedestrians = 0
    norm = []
    for d in dets:
        raw = str(d["raw_class"]).lower()
        norm.append({"class": raw, "confidence": d["confidence"], "bbox": d["bbox"], "class_id": d["class_id"], "raw_class": d["raw_class"]})
        if raw in TRAFFIC_VEHICLE_CLASSES or "car" in raw or "vehicle" in raw or "truck" in raw or "bus" in raw:
            vehicles += 1
        if raw in TRAFFIC_PEDESTRIAN_CLASSES or "person" in raw:
            pedestrians += 1
    return {"detections": norm, "vehicle_count": vehicles, "pedestrian_count": pedestrians}

# ---------- Pothole spatial plausibility gate ----------
# Normalized vertical ROI: pothole center_y must be >= threshold (lower part = road surface).
# Configurable via POTHOLE_ROAD_Y_THRESHOLD (0-1), conservative default 0.35 rejects clear sky/tree region.
POTHOLE_ROAD_Y_MIN = float(os.getenv("POTHOLE_ROAD_Y_THRESHOLD", "0.35"))

def _get_image_dims(image_path: str):
    try:
        img = cv2.imread(image_path)
        if img is not None:
            h, w = img.shape[0], img.shape[1]
            return h, w
    except:
        pass
    return None, None

def _is_pothole_plausible(bbox, img_h, img_w) -> bool:
    """Check normalized center_y >= POTHOLE_ROAD_Y_MIN. bbox = [x1,y1,x2,y2] in pixels."""
    if img_h is None or img_h == 0 or img_w is None:
        # cannot determine dims -> be permissive (do not reject) to avoid false negatives
        return True
    try:
        x1, y1, x2, y2 = bbox
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        ny = cy / float(img_h)
        # nx = cx / float(img_w)  # reserved for future horizontal ROI if needed
        # reject if clearly in upper sky/tree region
        if ny < POTHOLE_ROAD_Y_MIN:
            return False
        return True
    except:
        return True

def _filter_pothole_dets(dets: List[Dict], image_path: str):
    """Return (plausible, rejected) split. Keeps conservative ROI, does not use resolution-hardcoded pixels."""
    if not dets:
        return [], []
    h, w = _get_image_dims(image_path)
    plausible = []
    rejected = []
    for d in dets:
        if _is_pothole_plausible(d.get("bbox", [0,0,0,0]), h, w):
            plausible.append(d)
        else:
            rejected.append(d)
            try:
                cx = (d["bbox"][0]+d["bbox"][2])/2.0
                cy = (d["bbox"][1]+d["bbox"][3])/2.0
                ny = cy / float(h) if h else -1
                print(f"[POTHOLE_GATE] rejected bbox {d['bbox']} center_y_norm={ny:.3f} < {POTHOLE_ROAD_Y_MIN} conf={d.get('confidence')}")
            except:
                print(f"[POTHOLE_GATE] rejected bbox {d.get('bbox')} conf={d.get('confidence')}")
    return plausible, rejected

# ---------- Garbage spatial + confidence plausibility gate ----------
GARBAGE_MAX_BBOX_AREA_RATIO = float(os.getenv("GARBAGE_MAX_BBOX_AREA_RATIO", "0.70"))
GARBAGE_CONF_THRESHOLD = float(os.getenv("GARBAGE_CONFIDENCE_THRESHOLD", os.getenv("CONFIDENCE_THRESHOLD_GARBAGE", "0.50")))

def _is_garbage_plausible(bbox, img_h, img_w, confidence: float) -> bool:
    if img_h is None or img_w is None or img_h==0 or img_w==0:
        # no dims -> fallback to confidence only
        return confidence >= GARBAGE_CONF_THRESHOLD
    try:
        x1,y1,x2,y2 = bbox
        bw = max(0, x2 - x1)
        bh = max(0, y2 - y1)
        area = bw * bh
        img_area = float(img_h * img_w)
        ratio = area / img_area if img_area>0 else 0
        # reject giant full-image / background
        if ratio >= GARBAGE_MAX_BBOX_AREA_RATIO:
            return False
        # reject effectively entire-image bbox (touches all borders with large coverage)
        # check if bbox covers >90% width and >90% height and near origin
        if bw / img_w >= 0.90 and bh / img_h >= 0.90 and x1 <= img_w*0.05 and y1 <= img_h*0.05:
            return False
        # confidence gate conservative 0.50
        if confidence < GARBAGE_CONF_THRESHOLD:
            return False
        # implausible geometry: extremely thin sliver covering huge area already handled
        return True
    except:
        return confidence >= GARBAGE_CONF_THRESHOLD

def _filter_garbage_dets(dets: List[Dict], image_path: str):
    if not dets:
        return [], []
    h,w = _get_image_dims(image_path)
    plausible=[]; rejected=[]
    for d in dets:
        conf = float(d.get("confidence",0))
        if _is_garbage_plausible(d.get("bbox",[0,0,0,0]), h, w, conf):
            plausible.append(d)
        else:
            rejected.append(d)
            try:
                x1,y1,x2,y2 = d["bbox"]
                bw = x2-x1; bh=y2-y1
                ratio = (bw*bh)/(h*w) if h and w else -1
                print(f"[GARBAGE_GATE] rejected bbox {d['bbox']} area_ratio={ratio:.3f} >= {GARBAGE_MAX_BBOX_AREA_RATIO} or conf {conf} < {GARBAGE_CONF_THRESHOLD} class={d.get('class')}")
            except:
                print(f"[GARBAGE_GATE] rejected bbox {d.get('bbox')} conf={conf}")
    return plausible, rejected

# ---------- Unified image multi-inference ----------

CRACK_CLASSES = {"alligator_crack", "longitudinal_crack", "transverse_crack"}

ALLOWED_ROAD_INCIDENT_TYPES = {"potholes", "road_damage", "waterlogging"}

def select_final_incident(
    pothole_dets: List[Dict],
    road_dets: List[Dict],
    garbage_dets: List[Dict],
    traffic_meta: Dict[str, Any],
    water_result: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Centralized selection – ROAD-CONDITION SCOPE ONLY.
    Returns exactly ONE incident dict or None for allowed types: potholes, road_damage, waterlogging.
    Priority: road_damage crack > potholes > waterlogging (if model available). Garbage/traffic are IGNORED for simulator road-condition pipeline (final safety filter).
    water_result: dict from detect_waterlogging or None
    """
    road_cracks = [d for d in (road_dets or []) if d.get("class") in CRACK_CLASSES]
    road_potholes = [d for d in (road_dets or []) if d.get("class") == "pothole"]
    # 1. Road-damage crack has highest semantic priority
    if road_cracks:
        # pick highest confidence crack (deterministic)
        best = max(road_cracks, key=lambda x: x["confidence"])
        # group detections of same class for the incident
        cls = best["class"]
        dets = [d for d in road_cracks if d["class"] == cls]
        max_conf = max(d["confidence"] for d in dets)
        return {
            "incident_type": "road_damage",
            "confidence": round(max_conf, 4),
            "detections": sorted(dets, key=lambda x: x["confidence"], reverse=True),
            "model": MODEL_REGISTRY["road_damage"]["hf_model_id"],
            "detected_class": cls,
        }
    # 2. Pothole – deduplicate between dedicated model and road_damage pothole class (normalized to potholes)
    combined_potholes = _deduplicate_potholes((pothole_dets or []) + road_potholes)
    if combined_potholes:
        max_conf = max(d["confidence"] for d in combined_potholes)
        # choose model id by higher max conf if both contributed
        pothole_model = MODEL_REGISTRY["potholes"]["hf_model_id"]
        if road_potholes and pothole_dets:
            max_road = max((d["confidence"] for d in road_potholes), default=0)
            max_pot = max((d["confidence"] for d in pothole_dets), default=0)
            if max_road > max_pot:
                pothole_model = MODEL_REGISTRY["road_damage"]["hf_model_id"]
        # If only road_damage provided pothole, use road_damage model id (normalized pothole originates there)
        elif road_potholes and not pothole_dets:
            pothole_model = MODEL_REGISTRY["road_damage"]["hf_model_id"]
        return {
            "incident_type": "potholes",
            "confidence": round(max_conf, 4),
            "detections": sorted(combined_potholes, key=lambda x: x["confidence"], reverse=True),
            "model": pothole_model,
            "detected_class": "pothole",
        }
    # 3. Waterlogging — Zero-shot CLIP classification — no segmentation mask
    if water_result and water_result.get("detected"):
        return {
            "incident_type": "waterlogging",
            "confidence": float(water_result.get("confidence", water_result.get("water_score", 0))),
            "detections": [],
            "model": water_result.get("model", MODEL_REGISTRY.get("waterlogging",{}).get("hf_model_id","")),
            "water_score": float(water_result.get("water_score", water_result.get("confidence", 0))),
            "annotated_image_path": water_result.get("annotated_path"),
            "water_result": water_result,
        }
    # Garbage / traffic are NOT road-condition incidents for this SIH scope – intentionally ignored
    return None

def annotate_image(image_path: str, detections: List[Dict], out_path: str):
    """Draw detections on copy of image and save to out_path."""
    img = cv2.imread(image_path)
    if img is None:
        return None
    for d in detections:
        x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
        # color by class
        cls = str(d.get("class") or d.get("raw_class") or "").lower()
        if "pothole" in cls or "crack" in cls:
            color = (0, 0, 255)
        elif "garbage" in cls or d.get("class") in ["plastic","paper","metal","glass","cardboard","organic waste","organic_waste","medical waste","e-waste","ewaste"]:
            color = (0, 255, 0)
        elif "person" in cls or "pedestrian" in cls:
            color = (255, 0, 0)
        else:
            color = (255, 165, 0)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        label = f"{d.get('class', d.get('raw_class','obj'))} {d['confidence']:.2f}"
        cv2.putText(img, label, (x1, max(0, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(out_path, img)
    return out_path

def detect_image_multi(image_path: str) -> Dict[str, Any]:
    """
    Run enabled models on single image and return ONLY ONE final incident via select_final_incident.
    Returns dict with:
      incidents: [selected] or [] (exactly 0 or 1)
      traffic_meta, all_raw, processing_time, primary
    """
    start = time.time()
    all_raw = {}
    pothole_dets = []
    road_dets = []
    garbage_dets = []
    traffic_meta = {"vehicle_count": 0, "pedestrian_count": 0, "detections": []}

    try:
        pothole_dets = detect_pothole_model(image_path)
        all_raw["potholes"] = pothole_dets
    except Exception as e:
        print(f"[DETECT] pothole failed: {e}")
        all_raw["potholes_error"] = str(e)
    try:
        road_dets = detect_road_damage(image_path)
        all_raw["road_damage"] = road_dets
    except Exception as e:
        print(f"[DETECT] road_damage failed: {e}")
        all_raw["road_damage_error"] = str(e)
    try:
        garbage_dets = detect_garbage(image_path)
        all_raw["garbage"] = garbage_dets
    except Exception as e:
        print(f"[DETECT] garbage failed: {e}")
        all_raw["garbage_error"] = str(e)
    try:
        traffic_meta = detect_traffic(image_path)
        all_raw["traffic"] = traffic_meta
    except Exception as e:
        print(f"[DETECT] traffic failed: {e}")
        all_raw["traffic_error"] = str(e)
    water_result = None
    try:
        water_result = detect_waterlogging(image_path)
        all_raw["waterlogging"] = {"water_score": water_result.get("water_score"), "detected": water_result.get("detected"), "confidence": water_result.get("confidence")}
        if water_result.get("error"):
            all_raw["waterlogging_error"] = water_result.get("error")
    except Exception as e:
        print(f"[DETECT] waterlogging failed: {e}")
        all_raw["waterlogging_error"] = str(e)

    # --- Pothole spatial plausibility gate (normalized ROI, conservative) ---
    # Filter pothole bboxes whose center_y is in upper sky/tree region before selection.
    # Keep rejected in all_raw for debugging.
    pothole_plausible, pothole_rejected = _filter_pothole_dets(pothole_dets, image_path)
    # Split road_dets into cracks + pothole candidates and gate pothole subset
    road_cracks_raw = [d for d in (road_dets or []) if d.get("class") in CRACK_CLASSES]
    road_pothole_raw = [d for d in (road_dets or []) if d.get("class") == "pothole"]
    road_other_raw = [d for d in (road_dets or []) if d.get("class") not in CRACK_CLASSES and d.get("class") != "pothole"]
    road_pothole_plausible, road_pothole_rejected = _filter_pothole_dets(road_pothole_raw, image_path)
    road_dets_filtered = road_cracks_raw + road_pothole_plausible + road_other_raw
    if pothole_rejected:
        all_raw["potholes_rejected"] = pothole_rejected
        all_raw["potholes_plausible"] = pothole_plausible
    if road_pothole_rejected:
        all_raw["road_damage_pothole_rejected"] = road_pothole_rejected
        all_raw["road_damage_pothole_plausible"] = road_pothole_plausible
    # Garbage spatial + confidence gate
    garbage_plausible, garbage_rejected = _filter_garbage_dets(garbage_dets, image_path)
    if garbage_rejected:
        all_raw["garbage_rejected"] = garbage_rejected
        all_raw["garbage_plausible"] = garbage_plausible
    all_raw["garbage_filtered"] = garbage_plausible
    # Update raw entries to filtered for selector (but keep originals also in all_raw for debugging if needed)
    all_raw["potholes_filtered"] = pothole_plausible
    all_raw["road_damage_filtered"] = road_dets_filtered

    selected = select_final_incident(pothole_plausible, road_dets_filtered, garbage_plausible, traffic_meta, water_result)

    # Final safety filter: only road-condition types allowed
    if selected and selected.get("incident_type") not in ALLOWED_ROAD_INCIDENT_TYPES:
        print(f"[ROAD_FILTER] Dropping non-road incident {selected.get('incident_type')} (allowed: {ALLOWED_ROAD_INCIDENT_TYPES})")
        selected = None

    incidents = []
    if selected:
        tmpdir = Path(tempfile.gettempdir()) / "pothole_ai_annotated"
        stem = Path(image_path).stem
        # waterlogging already has annotated_path from segmentation
        if selected.get("incident_type") == "waterlogging":
            # annotated already from water_result
            if not selected.get("annotated_image_path") and water_result and water_result.get("annotated_path"):
                selected["annotated_image_path"] = water_result.get("annotated_path")
            elif not selected.get("annotated_image_path"):
                selected["annotated_image_path"] = None
            incidents = [selected]
        else:
            dets = selected["detections"]
            if dets:
                suffix = f"_{selected['incident_type']}_{selected.get('detected_class','')}"
                ann = str(tmpdir / f"{stem}{suffix}.jpg")
                annotate_image(image_path, dets, ann)
                selected["annotated_image_path"] = ann
            else:
                selected["annotated_image_path"] = None
            incidents = [selected]

    elapsed = time.time() - start
    return {
        "incidents": incidents,
        "traffic_meta": traffic_meta,
        "all_raw": all_raw,
        "processing_time": round(elapsed, 3),
        "primary": incidents[0] if incidents else None,
    }
