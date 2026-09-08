"""Unit tests for centralized incident selection policy: exactly one final incident."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from multi_detector import select_final_incident, CRACK_CLASSES

def _bbox(): return [0,0,10,10]

def test_A_longitudinal_plus_pothole():
    pothole = [{"class":"pothole","confidence":0.73,"bbox":_bbox(),"class_id":0,"raw_class":"pothole"}]
    road = [{"class":"longitudinal_crack","confidence":0.61,"bbox":_bbox(),"class_id":1,"raw_class":"Longitudinal Crack"}]
    sel = select_final_incident(pothole, road, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel is not None and sel["incident_type"]=="road_damage" and sel["detected_class"]=="longitudinal_crack", f"got {sel}"
    print("A PASS")

def test_B_transverse_plus_pothole():
    pothole=[{"class":"pothole","confidence":0.80,"bbox":_bbox(),"class_id":0,"raw_class":"pothole"}]
    road=[{"class":"transverse_crack","confidence":0.55,"bbox":_bbox(),"class_id":2,"raw_class":"Transverse Crack"}]
    sel=select_final_incident(pothole, road, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="road_damage" and sel["detected_class"]=="transverse_crack"
    print("B PASS")

def test_C_genuine_pothole():
    pothole=[{"class":"pothole","confidence":0.82,"bbox":_bbox(),"class_id":0,"raw_class":"pothole"}]
    sel=select_final_incident(pothole, [], [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="potholes" and sel["detected_class"]=="pothole"
    print("C PASS")

def test_D_road_damage_pothole_normalized():
    # road_damage detects pothole class -> should be normalized to potholes, not road_damage
    road=[{"class":"pothole","confidence":0.70,"bbox":_bbox(),"class_id":3,"raw_class":"Pothole"}]
    sel=select_final_incident([], road, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="potholes" and sel["detected_class"]=="pothole", f"got {sel}"
    print("D PASS")

def test_E_garbage():
    garbage=[{"class":"plastic","confidence":0.80,"bbox":_bbox(),"class_id":0,"raw_class":"plastic"}]
    sel=select_final_incident([], [], garbage, {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="garbage" and sel["detected_class"]=="plastic"
    print("E PASS")

def test_F_traffic():
    traffic={"vehicle_count":3,"pedestrian_count":1,"detections":[{"class":"car","confidence":0.75,"bbox":_bbox(),"class_id":2,"raw_class":"car"}]}
    sel=select_final_incident([], [], [], traffic)
    assert sel["incident_type"]=="traffic" and sel["vehicle_count"]==3
    print("F PASS")

def test_G_no_detection():
    sel=select_final_incident([], [], [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel is None
    print("G PASS")

def test_H_video_repeated_crack():
    # simulate video best_per_type with both crack and pothole, priority chooses crack
    # use select_final_incident with aggregated lists simulating repeated frames
    pothole=[{"class":"pothole","confidence":0.78,"bbox":_bbox(),"class_id":0,"raw_class":"pothole"}]
    road=[{"class":"longitudinal_crack","confidence":0.60,"bbox":_bbox(),"class_id":1,"raw_class":"Longitudinal Crack"},
          {"class":"longitudinal_crack","confidence":0.65,"bbox":_bbox(),"class_id":1,"raw_class":"Longitudinal Crack"}]
    sel=select_final_incident(pothole, road, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="road_damage"
    print("H PASS")

def test_priority_over_confidence():
    # crack 0.61 must beat pothole 0.73 (higher priority wins)
    pothole=[{"class":"pothole","confidence":0.73,"bbox":_bbox(),"class_id":0,"raw_class":"pothole"}]
    road=[{"class":"longitudinal_crack","confidence":0.61,"bbox":_bbox(),"class_id":1,"raw_class":"Longitudinal Crack"}]
    sel=select_final_incident(pothole, road, [], {"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="road_damage"
    print("PRIORITY PASS")

if __name__=="__main__":
    for fn in [test_A_longitudinal_plus_pothole, test_B_transverse_plus_pothole, test_C_genuine_pothole, test_D_road_damage_pothole_normalized, test_E_garbage, test_F_traffic, test_G_no_detection, test_H_video_repeated_crack, test_priority_over_confidence]:
        fn()
    print("ALL SELECTION TESTS PASSED")
