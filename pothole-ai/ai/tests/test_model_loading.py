"""Validate enabled Hugging Face models download, load, expose names, run inference."""
import sys, pathlib, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import os
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY","1")
import cv2, numpy as np
from pathlib import Path

def _make_test_image(path: str, w=640, h=640):
    # create cracked-road-like synthetic image: gray asphalt + dark line = longitudinal crack
    img = np.full((h,w,3), 120, dtype=np.uint8)
    # add noise
    noise = np.random.randint(0, 30, (h,w,3), dtype=np.uint8)
    img = cv2.add(img, noise)
    # longitudinal crack line
    cv2.line(img, (w//2, 20), (w//2+10, h-20), (30,30,30), 6)
    # transverse crack
    cv2.line(img, (20, h//2), (w-20, h//2+5), (40,40,40), 4)
    # pothole blob
    cv2.circle(img, (150,150), 25, (20,20,20), -1)
    cv2.imwrite(path, img)
    return path

def _test_model(key):
    from multi_detector import get_model
    m = get_model(key)
    assert m is not None, f"{key} failed to load"
    assert hasattr(m, "names") and isinstance(m.names, dict) and len(m.names)>0, f"{key} names missing"
    print(f"[TEST] {key} names: {m.names}")
    # run inference on synthetic image
    tmp = tempfile.mktemp(suffix=".jpg")
    _make_test_image(tmp)
    try:
        res = m(tmp, verbose=False)
        assert len(res)==1
        print(f"[TEST] {key} inference OK boxes: {res[0].boxes.shape if res[0].boxes is not None else 'none'}")
        # print raw detections for road_damage
        if key=="road_damage":
            from multi_detector import _run_yolo, MODEL_REGISTRY
            cfg = __import__("model_registry", fromlist=["MODEL_REGISTRY"]).MODEL_REGISTRY if False else None
            # just run via detect wrapper
            from multi_detector import detect_road_damage
            dets = detect_road_damage(tmp)
            print("MODEL: road_damage")
            for d in dets:
                print(f"CLASS: {d['raw_class']} -> {d['class']}")
                print(f"CONFIDENCE: {d['confidence']}")
                print(f"BBOX: {d['bbox']}")
            if not dets:
                print("MODEL: road_damage - no detections on synthetic (expected may be low conf)")
    finally:
        Path(tmp).unlink(missing_ok=True)
    print(f"[TEST] {key} PASS")

def test_all_enabled():
    from model_registry import MODEL_REGISTRY
    enabled = [k for k,v in MODEL_REGISTRY.items() if v.get("enabled") and v.get("hf_model_id")]
    print(f"Enabled: {enabled}")
    # For CI without network, allow skip if download fails – but mark as not claimed validated
    for k in enabled:
        try:
              _test_model(k)
        except Exception as e:
            # If network missing, we log and re-raise so test fails visibly – spec says do not claim validated
            print(f"[TEST] {k} FAILED: {e}")
            import traceback; traceback.print_exc()
            # For models that fail offline, we surface failure; pytest will mark failed
            raise

if __name__=="__main__":
    test_all_enabled()
    print("ALL MODEL LOADING TESTS DONE")

# pytest wrappers
def test_enabled_models_load():
    test_all_enabled()
