"""
ANPR: License plate detection + OCR + stolen registry.
Isolated demo registry - easy to replace with PostgreSQL later.
Pipeline: image/frame -> YOLO plate bbox -> crop -> OCR -> normalize -> stolen lookup
Model: keremberke/yolov5n-license-plate (pretrained YOLOv5n)
OCR: PaddleOCR preferred, fallback easyocr, fallback Awiros/anpr-ocr via transformers if available.
"""
import os
import re
import cv2
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# === Demo stolen registry - ISOLATED CONFIG ===
STOLEN_VEHICLES = {
    "AP39AB1234",
    "TS09CD5678",
    "AP37XY9999",
    "MH12AB1234",
    "DL01AB1234",
}

# Normalize: remove spaces/hyphens/punct, uppercase
def normalize_plate(text: str) -> str:
    if not text:
        return ""
    t = re.sub(r'[^A-Za-z0-9]', '', text)
    return t.upper().strip()

def _load_plate_model():
    from ultralytics import YOLO
    hf_id = "keremberke/yolov5n-license-plate"
    # Try hf:// then direct, then hub download
    for cand in [f"hf://{hf_id}", hf_id]:
        try:
            print(f"[ANPR] Loading plate model {cand}")
            m = YOLO(cand)
            print(f"[ANPR MODEL] Repository: {hf_id}")
            print(f"[ANPR MODEL] Local path: {cand}")
            print(f"[ANPR MODEL] Classes: {m.names}")
            print(f"[ANPR MODEL] Status: LOADED")
            return m
        except Exception as e:
            print(f"[ANPR] cand {cand} failed: {e}")
            continue
    try:
        from huggingface_hub import hf_hub_download, list_repo_files
        files = list_repo_files(hf_id)
        pt = next((f for f in files if f.endswith(".pt")), None)
        if pt:
            lp = hf_hub_download(repo_id=hf_id, filename=pt)
            print(f"[ANPR] hub download {pt} -> {lp}")
            from ultralytics import YOLO as Y2
            m2 = Y2(lp)
            print(f"[ANPR MODEL] Repository: {hf_id}")
            print(f"[ANPR MODEL] Local path: {lp}")
            print(f"[ANPR MODEL] Classes: {m2.names}")
            print(f"[ANPR MODEL] Status: LOADED (hub fallback)")
            return m2
    except Exception as e:
        print(f"[ANPR] hub fallback failed: {e}")
    print(f"[ANPR MODEL] Repository: {hf_id} Status: FAILED")
    return None

_plate_model = None
_plate_threshold = float(os.getenv("PLATE_CONF_THRESHOLD", "0.25"))

def get_plate_model():
    global _plate_model
    if _plate_model is not None:
        return _plate_model
    _plate_model = _load_plate_model()
    return _plate_model

# OCR lazy singletons
_ocr_reader = None
_paddle_ocr = None

def _get_easyocr():
    global _ocr_reader
    if _ocr_reader is not None:
        return _ocr_reader
    try:
        import easyocr
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        print("[ANPR] EasyOCR loaded")
        return _ocr_reader
    except Exception as e:
        print(f"[ANPR] EasyOCR not available: {e}")
        return None

def _get_paddleocr():
    global _paddle_ocr
    if _paddle_ocr is not None:
        return _paddle_ocr
    try:
        from paddleocr import PaddleOCR
        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        print("[ANPR] PaddleOCR loaded")
        return _paddle_ocr
    except Exception as e:
        print(f"[ANPR] PaddleOCR not available: {e}")
        return None

def _preprocess_variants(crop_bgr):
    """Yield multiple preprocessed variants for OCR robustness. Returns list of (name, image)."""
    import numpy as np
    # ensure crop is upscaled to height 100-120 before variants
    h0, w0 = crop_bgr.shape[:2]
    # base enlarged crop (height ~100)
    if h0 < 100:
        scale = 100 / max(1, h0)
        # cap scale to avoid huge blowup, max 3x
        scale = min(scale, 3.0)
        base = cv2.resize(crop_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    else:
        base = crop_bgr
    variants = [("A_original_enlarged", base)]
    try:
        # B grayscale + contrast enhancement (alpha/beta)
        gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
        # contrast stretch
        enhanced_contrast = cv2.convertScaleAbs(gray, alpha=1.5, beta=10)
        variants.append(("B_gray_contrast", cv2.cvtColor(enhanced_contrast, cv2.COLOR_GRAY2BGR)))
        # C CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        variants.append(("C_clahe", cv2.cvtColor(clahe_img, cv2.COLOR_GRAY2BGR)))
        # D bilateral + sharpen
        blur = cv2.bilateralFilter(base, 9, 75, 75)
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        sharpened = cv2.filter2D(blur, -1, kernel)
        variants.append(("D_bilateral_sharpen", sharpened))
        # E OTSU threshold (on clahe)
        _, otsu = cv2.threshold(clahe_img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(("E_otsu", cv2.cvtColor(otsu, cv2.COLOR_GRAY2BGR)))
        # F adaptive threshold
        adapt = cv2.adaptiveThreshold(clahe_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 10)
        variants.append(("F_adaptive", cv2.cvtColor(adapt, cv2.COLOR_GRAY2BGR)))
        # G inverted threshold (white text on black plate edge case)
        inv = cv2.bitwise_not(otsu)
        variants.append(("G_inverted_otsu", cv2.cvtColor(inv, cv2.COLOR_GRAY2BGR)))
        # H light denoise + sharpen (fastNlMeans)
        try:
            denoised = cv2.fastNlMeansDenoisingColored(base, None, 10, 10, 7, 21)
            kernel2 = np.array([[-1,-1,-1],[-1,9,-1],[-1,-1,-1]])
            sharp2 = cv2.filter2D(denoised, -1, kernel2)
            variants.append(("H_denoise_sharpen", sharp2))
        except Exception as e2:
            print(f"[OCR] denoise variant failed: {e2}")
    except Exception as e:
        print(f"[OCR] preprocess warning: {e}")
    return variants

ALLOWLIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

def ocr_plate_image(crop_bgr) -> Tuple[str, float]:
    """Return (text, confidence) from crop BGR image — tries multiple preprocess variants."""
    h0, w0 = crop_bgr.shape[:2]
    ar = w0 / max(1, h0)
    print(f"[OCR INPUT] crop width={w0} height={h0} aspect_ratio={ar:.2f}")
    variants = _preprocess_variants(crop_bgr)
    for name, v in variants:
        hv, wv = v.shape[:2]
        print(f"[OCR VARIANT] variant={name} size={wv}x{hv}")
    # try PaddleOCR first
    ocr = _get_paddleocr()
    if ocr is not None:
        try:
            best_txt, best_conf = "", 0.0
            best_name = ""
            for name, v in variants:
                result = ocr.ocr(v, cls=True)
                cur_txt, cur_conf = "", 0.0
                if result and result[0]:
                    cur = max(result[0], key=lambda x: x[1][1] if isinstance(x[1], tuple) else 0)
                    cur_txt, cur_conf = str(cur[1][0]), float(cur[1][1])
                print(f"[OCR VARIANT] {name} raw_text='{cur_txt}' confidence={cur_conf:.4f} normalized='{normalize_plate(cur_txt)}'")
                if cur_txt and float(cur_conf) > best_conf:
                    best_txt, best_conf, best_name = cur_txt, float(cur_conf), name
            if best_txt:
                print(f"[OCR] PaddleOCR best variant={best_name} raw_text={best_txt} conf={best_conf:.3f} normalized={normalize_plate(best_txt)}")
                return best_txt, best_conf
        except Exception as e:
            print(f"[ANPR] PaddleOCR inference failed: {e}")
    # fallback easyocr — try variants with allowlist, pick best valid
    reader = _get_easyocr()
    if reader is not None:
        try:
            candidates = []  # list of (txt, conf, name, normalized, len)
            for name, v in variants:
                try:
                    # prefer alphanumeric
                    try:
                        results = reader.readtext(v, allowlist=ALLOWLIST)
                    except TypeError:
                        results = reader.readtext(v)
                    cur_txt, cur_conf = "", 0.0
                    if results:
                        cur = max(results, key=lambda x: x[2])
                        cur_txt, cur_conf = str(cur[1]), float(cur[2])
                    norm = normalize_plate(cur_txt)
                    print(f"[OCR VARIANT] {name} raw_text='{cur_txt}' confidence={cur_conf:.4f} normalized='{norm}'")
                    if cur_txt:
                        candidates.append((cur_txt, cur_conf, name, norm, len(norm)))
                except Exception as e:
                    print(f"[OCR VARIANT] {name} failed: {e}")
            if candidates:
                # Prefer longest normalized >=6 with highest conf, else highest conf
                # Sort by (is_valid_len>=6, len, conf) descending
                def sort_key(c):
                    txt, conf, name, norm, nlen = c
                    valid = 1 if nlen >= 6 else 0
                    # penalize very short partial like "281" (len 3)
                    return (valid, nlen, conf)
                best = max(candidates, key=sort_key)
                best_txt, best_conf, best_name, best_norm, _ = best
                print(f"[OCR] EasyOCR best variant={best_name} raw_text={best_txt} conf={best_conf:.3f} normalized={best_norm}")
                # if best is partial (len <6) but another candidate longer, already handled; still log partial flag
                if len(best_norm) < 6 and len(best_norm) > 0:
                    print(f"[OCR] PARTIAL / LOW-CONFIDENCE OCR: '{best_txt}' -> '{best_norm}' len={len(best_norm)}")
                return best_txt, best_conf
        except Exception as e:
            print(f"[ANPR] EasyOCR failed: {e}")
    # last resort: try Awiros/anpr-ocr via transformers TrOCR
    try:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        from PIL import Image
        import torch
        proc = TrOCRProcessor.from_pretrained("Awiros/anpr-ocr")
        mdl = VisionEncoderDecoderModel.from_pretrained("Awiros/anpr-ocr")
        best_txt, best_conf = "", 0.0
        for name, v in variants:
            img = Image.fromarray(cv2.cvtColor(v, cv2.COLOR_BGR2RGB))
            pixel = proc(images=img, return_tensors="pt").pixel_values
            gen = mdl.generate(pixel)
            txt = proc.batch_decode(gen, skip_special_tokens=True)[0]
            print(f"[OCR VARIANT] {name} TrOCR raw_text='{txt}'")
            if txt and txt.strip():
                return str(txt), 0.85
    except Exception as e:
        print(f"[OCR] TrOCR not available: {e}")
    return "", 0.0

ANPR_IMGSZ = int(os.getenv("ANPR_IMGSZ", "1280"))

def detect_plates(image_path: str, imgsz: int = None) -> List[Dict[str, Any]]:
    """Detect plates in image file, return list of {bbox, confidence, plate_text, ocr_confidence, normalized, stolen, priority} + annotated_path."""
    if imgsz is None:
        imgsz = ANPR_IMGSZ
    model = get_plate_model()
    if model is None:
        print("[ANPR] ERROR: plate model not loaded — returning empty")
        return []
    # Verify image
    img = cv2.imread(image_path)
    if img is None:
        print(f"[ANPR] cv2.imread failed for {image_path}")
        return []
    h,w = img.shape[:2]
    print(f"[ANPR] image shape h={h} w={w} channels={img.shape[2] if len(img.shape)>2 else 1} dtype={img.dtype} path={image_path}")
    # YOLO inference - log raw before filtering
    try:
        # also run low-threshold debug for diagnostics (0.10) at current imgsz
        try:
            dbg = model(image_path, conf=0.10, imgsz=imgsz, verbose=False)
            if dbg[0].boxes is not None and len(dbg[0].boxes)>0:
                dconfs = dbg[0].boxes.conf.cpu().numpy()
                ddata = dbg[0].boxes.data.cpu().numpy()
                for idx in range(len(dconfs)):
                    row = ddata[idx]
                    print(f"[ANPR RAW] box_raw=[{row[0]:.1f},{row[1]:.1f},{row[2]:.1f},{row[3]:.1f}] confidence={float(dconfs[idx]):.4f} class=license_plate imgsz={imgsz}")
                    # log scale test
                    wbh = float(row[2]); hbh=float(row[3])
                    print(f"[ANPR SCALE TEST] imgsz={imgsz} detections={len(dconfs)} bbox_w={wbh:.0f} h={hbh:.0f}")
                    break
        except Exception as e:
            print(f"[ANPR RAW] debug low-thr failed: {e}")
        # scale tests for diagnostics
        for test_sz in [640,960,1280]:
            if test_sz == imgsz:
                continue
            try:
                r2 = model(image_path, conf=0.10, imgsz=test_sz, verbose=False)
                n2 = len(r2[0].boxes) if r2[0].boxes is not None else 0
                print(f"[ANPR SCALE TEST] imgsz={test_sz} detections={n2}")
            except Exception as e:
                print(f"[ANPR SCALE TEST] imgsz={test_sz} failed {e}")
        results = model(image_path, conf=_plate_threshold, imgsz=imgsz, verbose=False)
        raw_n = len(results[0].boxes) if results[0].boxes is not None else 0
        print(f"[ANPR] YOLO inference on {image_path} -> {raw_n} raw boxes @ thr={_plate_threshold}")
        if results[0].boxes is not None and raw_n>0:
            for idx in range(raw_n):
                c = float(results[0].boxes.conf[idx].cpu().numpy())
                d = results[0].boxes.data[idx].cpu().numpy()
                print(f"[ANPR] raw detection {idx}: xywh_center=[{d[0]:.1f},{d[1]:.1f},{d[2]:.1f},{d[3]:.1f}] confidence={c:.4f}")
    except Exception as e:
        print(f"[ANPR] YOLO failed: {e}")
        import traceback; traceback.print_exc()
        return []
    r = results[0]
    out = []
    if r.boxes is None or len(r.boxes)==0:
        print(f"[ANPR] No plates detected in {image_path} @ thr {_plate_threshold}")
        return out
    # Fix YOLOv5 bbox format: ultralytics Boxes.xyxy is corrupted for this YOLOv5 model
    # data cols are actually xywh center; convert manually
    try:
        data = r.boxes.data.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
        # detect if xyxy is invalid (x2<x1 or y2<y1)
        xyxy_check = r.boxes.xyxy.cpu().numpy()
        use_manual = False
        for row in xyxy_check:
            if row[2] <= row[0] or row[3] <= row[1]:
                use_manual = True
                break
        if use_manual:
            print("[ANPR] Detected corrupted xyxy (YOLOv5 format) -> using manual xywh->xyxy conversion")
            boxes = []
            for row in data:
                x,y,wb,hb = float(row[0]), float(row[1]), float(row[2]), float(row[3])
                x1 = x - wb/2; y1 = y - hb/2; x2 = x + wb/2; y2 = y + hb/2
                boxes.append([x1,y1,x2,y2])
            import numpy as np
            boxes = np.array(boxes, dtype=float)
        else:
            boxes = xyxy_check
    except Exception as e:
        print(f"[ANPR] bbox conversion failed, fallback to xyxy: {e}")
        boxes = r.boxes.xyxy.cpu().numpy()
        confs = r.boxes.conf.cpu().numpy()
    # NMS to dedup overlapping boxes (IoU 0.45)
    # Build list sorted by conf
    idxs = sorted(range(len(boxes)), key=lambda i: float(confs[i]), reverse=True)
    keep = []
    def _iou(a,b):
        xa1,ya1,xa2,ya2 = a; xb1,yb1,xb2,yb2 = b
        inter_x1=max(xa1,xb1); inter_y1=max(ya1,yb1); inter_x2=min(xa2,xb2); inter_y2=min(ya2,yb2)
        iw=max(0,inter_x2-inter_x1); ih=max(0,inter_y2-inter_y1)
        inter=iw*ih
        area_a=(xa2-xa1)*(ya2-ya1); area_b=(xb2-xb1)*(yb2-yb1)
        return inter/max(1,area_a+area_b-inter)
    for i in idxs:
        bi = [int(v) for v in boxes[i]]
        keep_candidate=True
        for k in keep:
            if _iou(bi, [int(v) for v in boxes[k]]) > 0.45:
                keep_candidate=False
                break
        if keep_candidate:
            keep.append(i)
    print(f"[ANPR] NMS kept {len(keep)}/{len(boxes)} boxes")
    for i in keep:
        conf = float(confs[i])
        if conf < _plate_threshold:
            continue
        x1,y1,x2,y2 = [int(v) for v in boxes[i]]
        x1=max(0,x1); y1=max(0,y1); x2=min(w,x2); y2=min(h,y2)
        if x2<=x1 or y2<=y1:
            print(f"[ANPR] skip invalid bbox [{x1},{y1},{x2},{y2}]")
            continue
        bw = x2 - x1; bh = y2 - y1; area = bw * bh; aspect = bw / max(1, bh)
        print(f"[ANPR] Plate detected bbox=[{x1},{y1},{x2},{y2}] w={bw} h={bh} area={area} aspect={aspect:.2f} detector_confidence={conf:.4f} class=license_plate")
        # Geometric filtering: reject obviously invalid tiny/degenerate boxes
        if bw < 40 or bh < 8 or area < 300 or aspect < 1.5 or aspect > 6.5:
            print(f"[ANPR] Reject bbox by geometry w={bw} h={bh} area={area} aspect={aspect:.2f}")
            continue
        # Add 10-15% padding (12%) around bbox, clamp
        pad_x = int(bw * 0.12)
        pad_y = int(bh * 0.12)
        px1 = max(0, x1 - pad_x); py1 = max(0, y1 - pad_y)
        px2 = min(w, x2 + pad_x); py2 = min(h, y2 + pad_y)
        if px2 > px1 and py2 > py1:
            x1, y1, x2, y2 = px1, py1, px2, py2
            bw = x2 - x1; bh = y2 - y1; area = bw * bh
            print(f"[ANPR] Padded bbox=[{x1},{y1},{x2},{y2}] w={bw} h={bh} pad_x={pad_x} pad_y={pad_y}")
        crop = img[y1:y2, x1:x2]
        if crop.size==0:
            continue
        ch, cw = crop.shape[:2]
        print(f"[OCR INPUT] crop before resize width={cw} height={ch} aspect={cw/max(1,ch):.2f}")
        # Upscale crop to ~150-200 px height preserving aspect (INTER_CUBIC / LANCZOS)
        target_h = 170
        if ch < target_h:
            scale = target_h / max(1, ch)
            # allow larger scale for tiny crops, use LANCZOS for quality
            try:
                interp = cv2.INTER_LANCZOS4
            except:
                interp = cv2.INTER_CUBIC
            crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=interp)
            print(f"[OCR INPUT] crop after resize width={crop.shape[1]} height={crop.shape[0]} scale={scale:.2f} interp=LANCZOS4")
        else:
            # also ensure at least INTER_CUBIC sharpen
            print(f"[OCR INPUT] crop sufficient height, no upscale needed")
        text, ocr_conf = ocr_plate_image(crop)
        print(f"[OCR] raw_text='{text}' normalized='{normalize_plate(text)}' confidence={ocr_conf:.4f}")
        normalized = normalize_plate(text)
        stolen = normalized in STOLEN_VEHICLES if normalized else False
        if stolen:
            print(f"[ANPR] STOLEN match: {normalized} Registry: DEMO STOLEN VEHICLE REGISTRY")
        # Distinguish OCR success vs failure
        if not normalized:
            # Plate detected but OCR unreadable
            status = "PLATE DETECTED — OCR FAILED"
            priority = "NORMAL"
            print(f"[ANPR] Plate detected but OCR unavailable/unreadable bbox=[{x1},{y1},{x2},{y2}] detector_confidence={conf:.4f} raw_text='{text}'")
        else:
            status = "STOLEN VEHICLE" if stolen else "CLEAR"
            priority = "CRITICAL" if stolen else "NORMAL"
        # Detailed per-stage logging
        print(f"[ANPR] raw bbox=[{int(boxes[i][0])},{int(boxes[i][1])},{int(boxes[i][2])},{int(boxes[i][3])}] converted bbox=[{x1},{y1},{x2},{y2}] confidence={conf:.4f} class=license_plate")
        out.append({
            "bbox": [x1,y1,x2,y2],
            "bbox_width": bw,
            "bbox_height": bh,
            "bbox_area": area,
            "confidence": round(conf,4),
            "detector_confidence": round(conf,4),
            "plate_text": text,
            "ocr_text": text,
            "plate_normalized": normalized,
            "normalized_plate": normalized,
            "ocr_confidence": round(float(ocr_conf),4),
            "stolen": bool(stolen),
            "status": status,
            "priority": priority,
        })
    print(f"[ANPR] Final detections for {image_path}: {len(out)}")
    return out

def annotate_plates(image_path: str, plates: List[Dict], out_path: str) -> str:
    img = cv2.imread(image_path)
    if img is None:
        return None
    for p in plates:
        x1,y1,x2,y2 = p["bbox"]
        color = (0,0,255) if p.get("stolen") else (0,255,0)
        cv2.rectangle(img, (x1,y1), (x2,y2), color, 2)
        label = f"{p.get('plate_normalized') or p.get('plate_text') or 'plate'} {p['confidence']:.2f}"
        cv2.putText(img, label, (x1, max(0,y1-8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        status = p.get("status","")
        if status=="STOLEN VEHICLE":
            cv2.putText(img, "STOLEN", (x1, y2+18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(out_path, img)
    return out_path
