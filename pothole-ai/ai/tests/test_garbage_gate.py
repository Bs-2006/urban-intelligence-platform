"""Tests for garbage spatial + confidence plausibility gate."""
import sys, pathlib, tempfile, cv2, numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from multi_detector import _filter_garbage_dets, select_final_incident, GARBAGE_MAX_BBOX_AREA_RATIO, GARBAGE_CONF_THRESHOLD
from pathlib import Path

def _make_image(h=2844, w=4288, path=None):
    # mimic traffic image dimensions from reported bbox
    if path is None:
        path = tempfile.mktemp(suffix=".jpg")
    img = np.full((h,w,3), 120, dtype=np.uint8)
    cv2.imwrite(path, img)
    return path, h, w

def test_A_giant_full_image_rejected():
    path,h,w = _make_image(h=2844,w=4288)
    try:
        bbox = [0, 3.14, 4288, 2844.7]  # reported giant
        dets = [{"class":"e-waste","confidence":0.4383,"bbox":bbox,"class_id":1,"raw_class":"e-waste"}]
        plausible, rejected = _filter_garbage_dets(dets, path)
        assert len(plausible)==0 and len(rejected)==1, f"A failed {plausible}"
        print("A PASS giant rejected")
    finally:
        Path(path).unlink(missing_ok=True)

def test_B_low_conf_rejected():
    path,h,w = _make_image(h=640,w=640)
    try:
        bbox = [100,100,200,200]  # small but low conf
        dets = [{"class":"plastic","confidence":0.4383,"bbox":bbox,"class_id":7,"raw_class":"plastic"}]
        plausible, rejected = _filter_garbage_dets(dets, path)
        assert len(plausible)==0, f"B should reject low conf {plausible}"
        print("B PASS low conf rejected")
    finally:
        Path(path).unlink(missing_ok=True)

def test_C_localized_plastic_accepted():
    path,h,w = _make_image(h=640,w=640)
    try:
        bbox = [100,100,200,200]  # area 10000 / 409600 =0.024 <0.70
        dets = [{"class":"plastic","confidence":0.65,"bbox":bbox,"class_id":7,"raw_class":"plastic"}]
        plausible, rejected = _filter_garbage_dets(dets, path)
        assert len(plausible)==1, f"C should accept {plausible}"
        print("C PASS localized plastic accepted")
    finally:
        Path(path).unlink(missing_ok=True)

def test_D_localized_ewaste_accepted():
    path,h,w = _make_image(h=640,w=640)
    try:
        bbox = [50,50,150,180]
        dets = [{"class":"e-waste","confidence":0.72,"bbox":bbox,"class_id":1,"raw_class":"e-waste"}]
        plausible, rejected = _filter_garbage_dets(dets, path)
        assert len(plausible)==1
        print("D PASS localized e-waste accepted")
    finally:
        Path(path).unlink(missing_ok=True)

def test_E_rejected_garbage_plus_traffic():
    path,h,w = _make_image(h=640,w=640)
    try:
        giant = [{"class":"e-waste","confidence":0.4383,"bbox":[0,0,630,630],"class_id":1,"raw_class":"e-waste"}]
        p,_ = _filter_garbage_dets(giant, path)
        sel = select_final_incident([], [], p, {"vehicle_count":2,"pedestrian_count":1,"detections":[{"class":"car","confidence":0.8,"bbox":[0,0,100,100],"class_id":2,"raw_class":"Car"}]})
        assert sel["incident_type"]=="traffic", f"E got {sel}"
        print("E PASS rejected garbage -> traffic")
    finally:
        Path(path).unlink(missing_ok=True)

def test_F_road_damage_plus_garbage():
    # road crack should win over garbage even with higher garbage conf (sanitized)
    road = [{"class":"longitudinal_crack","confidence":0.55,"bbox":[0,0,100,100],"class_id":0,"raw_class":"Longitudinal Crack"}]
    # garbage plausible but lower priority
    gar_path,h,w = _make_image(h=640,w=640)
    try:
        garbage = [{"class":"plastic","confidence":0.85,"bbox":[100,100,200,200],"class_id":7,"raw_class":"plastic"}]
        g_plaus,_ = _filter_garbage_dets(garbage, gar_path)
        sel = select_final_incident([], road, g_plaus, {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
        assert sel["incident_type"]=="road_damage", f"F got {sel}"
        print("F PASS road_damage wins over garbage")
    finally:
        Path(gar_path).unlink(missing_ok=True)

def test_G_genuine_garbage():
    path,h,w = _make_image(h=640,w=640)
    try:
        dets = [{"class":"plastic","confidence":0.78,"bbox":[100,100,220,240],"class_id":7,"raw_class":"plastic"}]
        p,_ = _filter_garbage_dets(dets, path)
        sel = select_final_incident([], [], p, {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
        assert sel["incident_type"]=="garbage" and sel["detected_class"]=="plastic"
        print("G PASS genuine garbage")
    finally:
        Path(path).unlink(missing_ok=True)

def test_H_no_valid():
    path,h,w = _make_image(h=640,w=640)
    try:
        # giant low conf garbage rejected, no traffic
        giant = [{"class":"e-waste","confidence":0.4383,"bbox":[0,0,630,630],"class_id":1,"raw_class":"e-waste"}]
        p,_ = _filter_garbage_dets(giant, path)
        sel = select_final_incident([], [], p, {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
        assert sel is None, f"H got {sel}"
        print("H PASS none")
    finally:
        Path(path).unlink(missing_ok=True)

if __name__=="__main__":
    for fn in [test_A_giant_full_image_rejected, test_B_low_conf_rejected, test_C_localized_plastic_accepted, test_D_localized_ewaste_accepted, test_E_rejected_garbage_plus_traffic, test_F_road_damage_plus_garbage, test_G_genuine_garbage, test_H_no_valid]:
        fn()
    print("ALL GARBAGE GATE TESTS PASSED")
