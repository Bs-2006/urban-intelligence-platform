"""Tests for pothole spatial plausibility gate."""
import sys, pathlib, tempfile, cv2, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from multi_detector import select_final_incident, _filter_pothole_dets, POTHOLE_ROAD_Y_MIN
from pathlib import Path

def _make_image(h=640, w=640, path=None):
    img = np.full((h,w,3), 120, dtype=np.uint8)
    if path is None:
        path = tempfile.mktemp(suffix=".jpg")
    cv2.imwrite(path, img)
    return path, h, w

def _bbox(center_y_norm, h, w, size=40):
    cy = center_y_norm * h
    cx = w/2
    x1 = cx - size/2; y1 = cy - size/2; x2 = cx + size/2; y2 = cy + size/2
    return [float(x1), float(y1), float(x2), float(y2)]

def test_A_road_lower_accepted():
    path,h,w = _make_image()
    try:
        bbox = _bbox(0.85, h, w)  # lower road
        dets = [{"class":"pothole","confidence":0.80,"bbox":bbox,"class_id":0,"raw_class":"Pothole"}]
        plausible, rejected = _filter_pothole_dets(dets, path)
        assert len(plausible)==1 and len(rejected)==0, f"lower should be plausible {plausible} {rejected}"
        print("A PASS lower accepted")
    finally:
        Path(path).unlink(missing_ok=True)

def test_B_sky_upper_rejected():
    path,h,w = _make_image()
    try:
        bbox = _bbox(0.15, h, w)  # upper sky/tree
        dets = [{"class":"pothole","confidence":0.586,"bbox":bbox,"class_id":0,"raw_class":"Pothole"}]
        plausible, rejected = _filter_pothole_dets(dets, path)
        assert len(plausible)==0 and len(rejected)==1, f"upper should be rejected {plausible}"
        # Ensure selector would then pick traffic if available
        sel = select_final_incident(plausible, [], [], {"vehicle_count":2,"pedestrian_count":1,"detections":[{"class":"car","confidence":0.7,"bbox":bbox,"class_id":2,"raw_class":"Car"}]})
        assert sel["incident_type"]=="traffic"
        print("B PASS upper rejected -> traffic")
    finally:
        Path(path).unlink(missing_ok=True)

def test_C_crack_still_wins():
    path,h,w = _make_image()
    try:
        poth_bbox = _bbox(0.80, h, w)
        poth = [{"class":"pothole","confidence":0.73,"bbox":poth_bbox,"class_id":0,"raw_class":"Pothole"}]
        road_crack = [{"class":"longitudinal_crack","confidence":0.55,"bbox":poth_bbox,"class_id":0,"raw_class":"Longitudinal Crack"}]
        # filter pothole plausible
        p_plaus, _ = _filter_pothole_dets(poth, path)
        sel = select_final_incident(p_plaus, road_crack, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
        assert sel["incident_type"]=="road_damage" and sel["detected_class"]=="longitudinal_crack"
        print("C PASS crack wins")
    finally:
        Path(path).unlink(missing_ok=True)

def test_D_genuine_pothole():
    path,h,w = _make_image()
    try:
        bbox = _bbox(0.75, h, w)
        poth = [{"class":"pothole","confidence":0.82,"bbox":bbox,"class_id":0,"raw_class":"Pothole"}]
        p_plaus,_ = _filter_pothole_dets(poth, path)
        sel = select_final_incident(p_plaus, [], [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
        assert sel["incident_type"]=="potholes"
        print("D PASS genuine pothole")
    finally:
        Path(path).unlink(missing_ok=True)

def test_E_rejected_pothole_plus_traffic():
    path,h,w = _make_image()
    try:
        bbox_sky = _bbox(0.10, h, w)
        poth = [{"class":"pothole","confidence":0.586,"bbox":bbox_sky,"class_id":0,"raw_class":"Pothole"}]
        p_plaus,_ = _filter_pothole_dets(poth, path)
        sel = select_final_incident(p_plaus, [], [], {"vehicle_count":3,"pedestrian_count":1,"detections":[{"class":"car","confidence":0.75,"bbox":bbox_sky,"class_id":2,"raw_class":"Car"}]})
        assert sel["incident_type"]=="traffic"
        print("E PASS rejected pothole -> traffic")
    finally:
        Path(path).unlink(missing_ok=True)

def test_F_no_valid():
    sel = select_final_incident([], [], [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel is None
    print("F PASS none")

def test_detect_image_multi_spatial():
    # End-to-end: create image and mock pothole detection via gate filtered synthetic
    # We test gate directly via detect_image_multi with synthetic model monkey patch
    import multi_detector as md
    path,h,w = _make_image(h=480,w=640)
    try:
        # monkey patch detect_pothole_model to return sky bbox
        orig = md.detect_pothole_model
        def fake_pothole(img_path):
            # sky bbox
            bbox = _bbox(0.15, 480, 640)
            return [{"class":"pothole","confidence":0.586,"bbox":bbox,"class_id":0,"raw_class":"Pothole"}]
        def fake_road(img_path): return []
        def fake_garbage(img_path): return []
        def fake_traffic(img_path): return {"vehicle_count":2,"pedestrian_count":0,"detections":[{"class":"car","confidence":0.8,"bbox":_bbox(0.6,480,640),"class_id":2,"raw_class":"Car"}]}
        md.detect_pothole_model = fake_pothole
        md.detect_road_damage = fake_road
        md.detect_garbage = fake_garbage
        md.detect_traffic = fake_traffic
        res = md.detect_image_multi(path)
        assert len(res["incidents"])==1 and res["incidents"][0]["incident_type"]=="traffic", f"got {res['incidents']}"
        print("end-to-end spatial gate PASS")
    finally:
        md.detect_pothole_model = orig
        # restore others
        import importlib; importlib.reload(md)
        Path(path).unlink(missing_ok=True)

if __name__=="__main__":
    for fn in [test_A_road_lower_accepted, test_B_sky_upper_rejected, test_C_crack_still_wins, test_D_genuine_pothole, test_E_rejected_pothole_plus_traffic, test_F_no_valid, test_detect_image_multi_spatial]:
        fn()
    print("ALL GATE TESTS PASSED")
