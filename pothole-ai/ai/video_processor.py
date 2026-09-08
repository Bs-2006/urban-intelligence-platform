"""
Video processing: multi-defect aware.
- Single-model process_video() preserved for backward compat (pothole).
- New process_video_multi() samples frames and runs multi_detector.detect_image_multi per frame,
  aggregates best frame per incident_type.
"""
import os
import cv2
import tempfile
from pathlib import Path
from typing import Dict, Any, List
import time

FRAME_SKIP = int(os.getenv("FRAME_SKIP", "5"))

def process_video(video_path: str, conf_threshold: float = None) -> Dict[str, Any]:
    """Back-compat pothole-only video processor."""
    try:
        from pothole_detector import detect_image, CONFIDENCE_THRESHOLD, HF_MODEL_ID
    except ImportError:
        from ai.pothole_detector import detect_image, CONFIDENCE_THRESHOLD, HF_MODEL_ID
    threshold = conf_threshold if conf_threshold is not None else CONFIDENCE_THRESHOLD
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    start = time.time()
    frame_idx = 0
    sampled = 0
    detections_all = []
    max_conf = 0.0
    best_frame_info = None
    best_annotated = None
    temp_dir = Path(tempfile.gettempdir()) / "pothole_ai_video_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % FRAME_SKIP == 0:
            sampled += 1
            frame_path = str(temp_dir / f"frame_{frame_idx}.jpg")
            cv2.imwrite(frame_path, frame)
            result = detect_image(frame_path, conf_threshold=threshold)
            if result["detected"]:
                ts = frame_idx / fps if fps else 0
                entry = {"frame_number": frame_idx, "timestamp": round(ts, 2), "confidence": result["confidence"], "detections": result["detections"]}
                detections_all.append(entry)
                if result["confidence"] > max_conf:
                    max_conf = result["confidence"]
                    best_frame_info = entry
                    best_annotated = result.get("annotated_image_path")
                if best_annotated is None and result.get("annotated_image_path"):
                    best_annotated = result.get("annotated_image_path")
                    best_frame_info = entry
            try:
                Path(frame_path).unlink(missing_ok=True)
            except:
                pass
        frame_idx += 1
    cap.release()
    elapsed = time.time() - start
    detected = len(detections_all) > 0
    return {
        "detected": detected,
        "incident_type": "potholes" if detected else None,
        "confidence": round(max_conf, 4) if detected else 0.0,
        "detections": detections_all[0]["detections"] if detections_all else [],
        "frame_detections": detections_all,
        "frames_processed": sampled,
        "total_frames": total_frames,
        "fps": fps,
        "annotated_image_path": best_annotated,
        "best_frame": best_frame_info,
        "processing_time": round(elapsed, 3),
        "model": HF_MODEL_ID,
    }


def process_video_multi(video_path: str) -> Dict[str, Any]:
    """
    Multi-defect video: sample frames, run multi_detector per frame,
    aggregate per incident_type.
    Returns:
      incidents: list per-type with best_frame, annotated path, confidence
      frame_detections: list of per-frame raw incidents
      traffic_aggregate: avg/max vehicle counts
    """
    try:
        from multi_detector import detect_image_multi
    except ImportError:
        from ai.multi_detector import detect_image_multi

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Cannot open video {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    start = time.time()
    frame_idx = 0
    sampled = 0
    temp_dir = Path(tempfile.gettempdir()) / "pothole_ai_video_frames"
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Accumulators for final single-incident selection
    best_per_type: Dict[str, Dict] = {}
    frame_detections: List[Dict] = []
    all_traffic_counts: List[Dict] = []
    # Also accumulate raw all detections for priority debugging: collect all_model_results
    aggregated_all_raw: Dict[str, List] = {"potholes": [], "road_damage": [], "garbage": [], "traffic": []}

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % FRAME_SKIP == 0:
            sampled += 1
            frame_path = str(temp_dir / f"frame_{frame_idx}.jpg")
            cv2.imwrite(frame_path, frame)
            try:
                res = detect_image_multi(frame_path)
            except Exception as e:
                print(f"[VIDEO_MULTI] frame {frame_idx} failed: {e}")
                res = {"incidents": [], "traffic_meta": {}, "all_raw": {}}
            ts = frame_idx / fps if fps else 0
            # aggregate raw for debugging
            ar = res.get("all_raw") or {}
            for k in ["potholes", "road_damage", "garbage"]:
                if ar.get(k):
                    aggregated_all_raw[k].extend(ar[k])
            if ar.get("traffic"):
                aggregated_all_raw["traffic"].append(ar["traffic"])
            if res.get("incidents"):
                for inc in res["incidents"]:
                    key = inc["incident_type"]
                    entry = {
                        "frame_number": frame_idx,
                        "timestamp": round(ts, 2),
                        "incident_type": key,
                        "confidence": inc["confidence"],
                        "detections": inc["detections"],
                        "model": inc["model"],
                        "detected_class": inc.get("detected_class"),
                        "annotated_image_path": inc.get("annotated_image_path"),
                    }
                    if "vehicle_count" in inc:
                        entry["vehicle_count"] = inc["vehicle_count"]
                        entry["pedestrian_count"] = inc["pedestrian_count"]
                    frame_detections.append(entry)
                    if key not in best_per_type or inc["confidence"] > best_per_type[key]["confidence"]:
                        best_per_type[key] = {
                            "incident_type": key,
                            "confidence": inc["confidence"],
                            "detections": inc["detections"],
                            "model": inc["model"],
                            "annotated_image_path": inc.get("annotated_image_path"),
                            "detected_class": inc.get("detected_class"),
                            "frame_number": frame_idx,
                            "video_timestamp": round(ts, 2),
                            "vehicle_count": inc.get("vehicle_count"),
                            "pedestrian_count": inc.get("pedestrian_count"),
                        }
            tm = res.get("traffic_meta") or {}
            if tm:
                all_traffic_counts.append(tm)
            try:
                Path(frame_path).unlink(missing_ok=True)
            except:
                pass
        frame_idx += 1

    cap.release()
    elapsed = time.time() - start

    # Road-condition priority: road_damage crack > potholes > waterlogging (garbage/traffic excluded)
    priority = ["road_damage", "potholes", "waterlogging"]
    final_incident = None
    for p in priority:
        if p in best_per_type:
            final_incident = best_per_type[p]
            break
    # Safety filter: ensure only road-condition incidents survive
    if final_incident and final_incident.get("incident_type") not in {"potholes", "road_damage", "waterlogging"}:
        final_incident = None
    incidents = [final_incident] if final_incident else []

    # Aggregate traffic stats
    avg_vehicle = 0
    max_vehicle = 0
    if all_traffic_counts:
        vs = [x.get("vehicle_count", 0) for x in all_traffic_counts]
        max_vehicle = max(vs) if vs else 0
        avg_vehicle = round(sum(vs)/len(vs), 1) if vs else 0

    return {
        "incidents": incidents,
        "frame_detections": frame_detections,
        "frames_processed": sampled,
        "total_frames": total_frames,
        "fps": fps,
        "processing_time": round(elapsed, 3),
        "detected": len(incidents) > 0,
        "traffic_aggregate": {"avg_vehicle_count": avg_vehicle, "max_vehicle_count": max_vehicle},
        "all_raw_aggregated": aggregated_all_raw,
    }
