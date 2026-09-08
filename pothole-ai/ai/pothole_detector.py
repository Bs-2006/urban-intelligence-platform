"""
Common pothole detector used by both manual uploads and bus observation worker.
Wraps Ultralytics YOLO with huggingface model EngJamesO/pothole-detector.
"""
import os
import time
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional
import cv2
from PIL import Image
import numpy as np

try:
    from model_registry import MODEL_REGISTRY
except ImportError:
    from ai.model_registry import MODEL_REGISTRY

# Config
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))
HF_MODEL_ID = MODEL_REGISTRY["potholes"]["hf_model_id"]

_model = None
_model_names = None

def get_model():
    global _model, _model_names
    if _model is not None:
        return _model
    print(f"[MODEL] Loading {HF_MODEL_ID} ...")
    try:
        from ultralytics import YOLO
        # Try hf:// scheme (ultralytics >=8 supports HF)
        candidates = [
            f"hf://{HF_MODEL_ID}",
            HF_MODEL_ID,
        ]
        last_err = None
        for cand in candidates:
            try:
                print(f"[MODEL] Trying YOLO('{cand}')")
                _model = YOLO(cand)
                print(f"[MODEL] Loaded via '{cand}'")
                break
            except Exception as e:
                last_err = e
                print(f"[MODEL] Failed cand {cand}: {e}")
                continue
        if _model is None:
            # fallback: download via huggingface_hub
            print("[MODEL] Falling back to huggingface_hub download")
            from huggingface_hub import hf_hub_download, list_repo_files
            files = list_repo_files(HF_MODEL_ID)
            # find .pt file
            pt_file = None
            for f in files:
                if f.endswith(".pt"):
                    pt_file = f
                    break
            if not pt_file:
                raise RuntimeError(f"No .pt file found in {HF_MODEL_ID}, files: {files}")
            local_path = hf_hub_download(repo_id=HF_MODEL_ID, filename=pt_file)
            print(f"[MODEL] Downloaded {pt_file} -> {local_path}")
            from ultralytics import YOLO as Y2
            _model = Y2(local_path)
        _model_names = _model.names
        print(f"[MODEL] Class names: {_model_names}")
        print(f"[MODEL] Loaded successfully")
    except Exception as e:
        print(f"[MODEL] Fatal load error: {e}")
        raise
    return _model

def get_class_names():
    m = get_model()
    return m.names

def _is_pothole_class(class_name: str, class_id: int) -> bool:
    # Only pothole counts
    name = str(class_name).lower()
    return "pothole" in name

def detect_image(image_path: str, conf_threshold: Optional[float] = None) -> Dict[str, Any]:
    """
    Run pothole detection on single image.
    Returns dict with detected, incident_type, confidence, detections, annotated_path, processing_time, model
    """
    threshold = conf_threshold if conf_threshold is not None else CONFIDENCE_THRESHOLD
    model = get_model()
    start = time.time()
    
    # ultralytics inference
    results = model(image_path, conf=threshold, verbose=False)
    r = results[0]
    detections = []
    max_conf = 0.0
    
    if r.boxes is not None and len(r.boxes) > 0:
        boxes = r.boxes.xyxy.cpu().numpy()  # x1 y1 x2 y2
        confs = r.boxes.conf.cpu().numpy()
        classes = r.boxes.cls.cpu().numpy().astype(int)
        names = model.names
        for i in range(len(boxes)):
            cls_id = int(classes[i])
            cls_name = names.get(cls_id, str(cls_id))
            conf = float(confs[i])
            # Only keep pothole
            if not _is_pothole_class(cls_name, cls_id):
                continue
            if conf < threshold:
                continue
            x1, y1, x2, y2 = [float(v) for v in boxes[i]]
            detections.append({
                "class": "pothole",
                "confidence": round(conf, 4),
                "bbox": [round(x1,2), round(y1,2), round(x2,2), round(y2,2)],
                "class_id": cls_id,
                "raw_class": cls_name,
            })
            if conf > max_conf:
                max_conf = conf
    
    # Sort by confidence desc
    detections.sort(key=lambda x: x["confidence"], reverse=True)
    detected = len(detections) > 0
    elapsed = time.time() - start
    
    # Create annotated image if detected
    annotated_path = None
    if detected:
        try:
            # Use ultralytics plot
            annotated = r.plot()  # BGR numpy
            # Filter to only pothole boxes? r.plot shows all. We re-draw filtered for accuracy.
            # Instead we manually draw filtered boxes on original image
            img = cv2.imread(image_path)
            if img is not None:
                for d in detections:
                    x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
                    cv2.rectangle(img, (x1,y1), (x2,y2), (0,0,255), 2)
                    label = f"pothole {d['confidence']:.2f}"
                    cv2.putText(img, label, (x1, max(0,y1-5)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
                # Save to temp
                tmpdir = Path(tempfile.gettempdir()) / "pothole_ai_annotated"
                tmpdir.mkdir(parents=True, exist_ok=True)
                out_name = Path(image_path).stem + "_annotated.jpg"
                annotated_path = str(tmpdir / out_name)
                cv2.imwrite(annotated_path, img)
            else:
                # fallback to r.plot
                tmpdir = Path(tempfile.gettempdir()) / "pothole_ai_annotated"
                tmpdir.mkdir(parents=True, exist_ok=True)
                out_name = Path(image_path).stem + "_annotated.jpg"
                annotated_path = str(tmpdir / out_name)
                cv2.imwrite(annotated_path, annotated)
        except Exception as e:
            print(f"[DETECT] annotate failed: {e}")
            annotated_path = None

    return {
        "detected": detected,
        "incident_type": "potholes" if detected else None,
        "confidence": round(max_conf, 4) if detected else 0.0,
        "detections": detections,
        "annotated_image_path": annotated_path,
        "processing_time": round(elapsed, 3),
        "model": HF_MODEL_ID,
    }

def detect_image_bytes(image_bytes: bytes, filename: str = "upload.jpg", conf_threshold: Optional[float] = None) -> Dict[str, Any]:
    """Helper: write bytes to temp file then detect"""
    suffix = Path(filename).suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name
    try:
        return detect_image(tmp_path, conf_threshold)
    finally:
        # keep file briefly? cleanup after annotated generated. Let OS handle.
        pass
