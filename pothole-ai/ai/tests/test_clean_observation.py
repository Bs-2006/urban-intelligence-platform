"""Tests for clean-road observation reporting (bus simulator)."""
import sys, pathlib, tempfile, json
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from incident_client import build_observation_status
from multi_detector import select_final_incident

OBS = {"id":"obs-123","latitude":16.556,"longitude":81.615,"bus_id":"BVR-101","route_id":"BVR001","occurred_at":"2026-09-05T09:00:00Z","image_path":"/uploads/img.jpg"}

def _make_traffic_meta(): return {"vehicle_count":2,"pedestrian_count":1,"detections":[{"class":"car","confidence":0.8,"bbox":[0,0,100,100],"class_id":2,"raw_class":"Car"}]}

def test_A_pothole_one_incident():
    poth=[{"class":"pothole","confidence":0.82,"bbox":[0,0,100,100],"class_id":0,"raw_class":"Pothole"}]
    sel=select_final_incident(poth,[],[],{"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="potholes"
    # clean should NOT be created when incident exists
    has_clean = sel is None
    assert not has_clean
    print("A PASS pothole one incident")

def test_B_road_damage_one_incident():
    road=[{"class":"longitudinal_crack","confidence":0.6,"bbox":[0,0,100,100],"class_id":0,"raw_class":"Longitudinal Crack"}]
    sel=select_final_incident([],road,[],{"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="road_damage"
    print("B PASS road_damage")

def test_C_garbage_one_incident():
    gar=[{"class":"plastic","confidence":0.75,"bbox":[0,0,100,100],"class_id":7,"raw_class":"plastic"}]
    sel=select_final_incident([],[],gar,{"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel["incident_type"]=="garbage"
    print("C PASS garbage")

def test_D_traffic_one_incident():
    sel=select_final_incident([],[],[],_make_traffic_meta())
    assert sel["incident_type"]=="traffic"
    print("D PASS traffic")

def test_E_no_detection_clean():
    sel=select_final_incident([],[],[],{"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel is None
    clean=build_observation_status(OBS, media_type="image", all_model_results={"potholes":[],"road_damage":[]})
    assert clean["status"]=="clear" and clean["detected"]==False and clean["observation_id"]=="obs-123"
    assert clean["incident_payload_json"] is None if "incident_payload_json" in clean else True
    print("E PASS clean observation")

def test_F_video_no_detection_clean():
    sel=select_final_incident([],[],[],{"vehicle_count":0,"pedestrian_count":0,"detections":[]})
    assert sel is None
    clean=build_observation_status(OBS, media_type="video", all_model_results={})
    assert clean["media_type"]=="video" and clean["status"]=="clear"
    print("F PASS video clean")

def test_G_metadata_preserved():
    clean=build_observation_status(OBS, media_type="image", all_model_results={"x":1})
    assert clean["bus_id"]=="BVR-101" and clean["route_id"]=="BVR001"
    assert clean["latitude"]==16.556 and clean["longitude"]==81.615
    assert clean["occurred_at"]=="2026-09-05T09:00:00Z"
    assert clean["metadata_json"]["all_model_results"]=={"x":1}
    # DB persistence test with temp db
    import tempfile, sqlite3, os
    from pathlib import Path
    tmpdb = tempfile.mktemp(suffix=".db")
    os.environ["AI_DB_PATH"]=tmpdb  # not used, we directly test worker init with temp path
    # simulate worker DB insert for clean
    from observation_worker import get_ai_db, init_ai_db
    # monkey patch AI_DB_PATH to tmpdb
    import observation_worker as ow
    orig_path = ow.AI_DB_PATH
    ow.AI_DB_PATH = Path(tmpdb)
    ow.init_ai_db()
    conn = ow.get_ai_db()
    cur=conn.cursor()
    cur.execute("INSERT OR REPLACE INTO observation_analysis (observation_id,bus_id,route_id,image_path,analysis_status,detected,status,observation_status,observation_status_json,all_model_results_json,media_type,analyzed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (clean["observation_id"],clean["bus_id"],clean["route_id"],"/tmp/x.jpg","analyzed",0,"clear","clear",json.dumps(clean),json.dumps({"x":1}),"image",clean["analyzed_at"]))
    # above has 13 placeholders but we have 13 columns – adjust count: we inserted 13 values, need 13 ?
    conn.commit()
    cur.execute("SELECT * FROM observation_analysis WHERE observation_id=?", (clean["observation_id"],))
    row=dict(cur.fetchone())
    assert row["bus_id"]=="BVR-101" and row["status"]=="clear" and row["detected"]==0
    conn.close()
    Path(tmpdb).unlink(missing_ok=True)
    ow.AI_DB_PATH = orig_path
    print("G PASS metadata preserved in DB")

if __name__=="__main__":
    for fn in [test_A_pothole_one_incident,test_B_road_damage_one_incident,test_C_garbage_one_incident,test_D_traffic_one_incident,test_E_no_detection_clean,test_F_video_no_detection_clean,test_G_metadata_preserved]:
        fn()
    print("ALL CLEAN OBSERVATION TESTS PASSED")
