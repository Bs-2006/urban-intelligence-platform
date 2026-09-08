import { useState, useRef } from "react";

const AI_BASE = import.meta.env.VITE_AI_BASE_URL || "http://localhost:8001";
type ModelOpt = "pothole" | "damaged_road" | "waterlogging";

export default function App() {
  const [model, setModel] = useState<ModelOpt>("pothole");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ANPR Image
  const [anprFile, setAnprFile] = useState<File | null>(null);
  const [anprPreview, setAnprPreview] = useState<string | null>(null);
  const [anprLoading, setAnprLoading] = useState(false);
  const [anprResult, setAnprResult] = useState<any>(null);
  const [anprError, setAnprError] = useState<string | null>(null);
  const anprInputRef = useRef<HTMLInputElement>(null);

  // ANPR Video
  const [anprVideoFile, setAnprVideoFile] = useState<File | null>(null);
  const [anprVideoLoading, setAnprVideoLoading] = useState(false);
  const [anprVideoResult, setAnprVideoResult] = useState<any>(null);
  const [anprVideoError, setAnprVideoError] = useState<string | null>(null);
  const anprVideoInputRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    const ok = ["jpg", "jpeg", "png", "webp"].includes(ext || "");
    if (!ok) { setError("Unsupported format. Use JPG, JPEG, PNG, WEBP."); return; }
    if (f.size > 5 * 1024 * 1024) { setError("Image too large (max 5 MB)."); return; }
    setError(null);
    setResult(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0] || null);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    onFile(e.dataTransfer.files?.[0] || null);
  };

  const detect = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("model", model);
      const resp = await fetch(`${AI_BASE}/api/demo/detect`, { method: "POST", body: fd });
      if (!resp.ok) {
        const txt = await resp.text();
        let msg = txt;
        try { const j = JSON.parse(txt); msg = j.detail || j.message || txt; } catch {}
        throw new Error(msg || `Request failed ${resp.status}`);
      }
      const data = await resp.json();
      setResult(data);
    } catch (e: any) {
      if (e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError")) {
        setError(`AI service unavailable at ${AI_BASE}. Is the AI service running on port 8001?`);
      } else {
        setError(e.message || "Inference failed.");
      }
    } finally { setLoading(false); }
  };

  const clear = () => {
    setFile(null); setPreview(null); setResult(null); setError(null);
    if (preview) URL.revokeObjectURL(preview);
  };

  const annotatedSrc = result?.annotated_image_base64
    ? `data:image/jpeg;base64,${result.annotated_image_base64}`
    : result?.annotated_image_url
      ? `${AI_BASE}${result.annotated_image_url}`
      : null;

  const anprAnnotatedSrc = anprResult?.annotated_image_base64
    ? `data:image/jpeg;base64,${anprResult.annotated_image_base64}`
    : anprResult?.annotated_image_url ? `${AI_BASE}${anprResult.annotated_image_url}` : null;

  const modelLabel: Record<ModelOpt, string> = { pothole: "Pothole", damaged_road: "Damaged Road", waterlogging: "Waterlogging" };
  const modelIds: Record<ModelOpt, string> = {
    pothole: "EngJamesO/pothole-detector",
    damaged_road: "cvtechniques/road-damage-detection-yolov11",
    waterlogging: "emnaRa/dgs_segmentation",
  };

  const onAnprFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["jpg","jpeg","png","webp"].includes(ext||"")) { setAnprError("Use JPG/PNG/WEBP"); return; }
    setAnprError(null); setAnprResult(null);
    setAnprFile(f); setAnprPreview(URL.createObjectURL(f));
  };
  const runAnprImage = async () => {
    if (!anprFile) return;
    setAnprLoading(true); setAnprError(null); setAnprResult(null);
    try {
      const fd = new FormData(); fd.append("file", anprFile);
      const r = await fetch(`${AI_BASE}/api/demo/anpr`, { method:"POST", body: fd });
      if (!r.ok) { const t=await r.text(); let m=t; try{ m=JSON.parse(t).detail||t}catch{}; throw new Error(m); }
      setAnprResult(await r.json());
    } catch(e:any){ setAnprError(e.message||"ANPR failed"); } finally{ setAnprLoading(false); }
  };
  const loadDemoImage = async () => {
    try {
      setAnprError(null);
      const r = await fetch(`${AI_BASE}/api/demo/anpr/demo-image`);
      if (!r.ok) throw new Error("Demo image not found on server");
      const blob = await r.blob();
      const f = new File([blob], "demo_stolen_AP39AB1234.jpg", { type: "image/jpeg" });
      setAnprFile(f); setAnprPreview(URL.createObjectURL(blob)); setAnprResult(null);
    } catch(e:any){ setAnprError(e.message); }
  };
  const loadDemoVideo = async () => {
    try {
      setAnprVideoError(null);
      const r = await fetch(`${AI_BASE}/api/demo/anpr/demo-video`);
      if (!r.ok) throw new Error("Demo video not found on server");
      const blob = await r.blob();
      const f = new File([blob], "demo_stolen_AP39AB1234.mp4", { type: "video/mp4" });
      setAnprVideoFile(f); setAnprVideoResult(null);
    } catch(e:any){ setAnprVideoError(e.message); }
  };

  const onAnprVideoFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["mp4","mov","avi","mkv","webm"].includes(ext||"")) { setAnprVideoError("Use MP4/MOV/AVI/MKV/WEBM"); return; }
    setAnprVideoError(null); setAnprVideoResult(null);
    setAnprVideoFile(f);
  };
  const runAnprVideo = async () => {
    if (!anprVideoFile) return;
    setAnprVideoLoading(true); setAnprVideoError(null); setAnprVideoResult(null);
    try {
      const fd = new FormData(); fd.append("file", anprVideoFile); fd.append("interval","3");
      const r = await fetch(`${AI_BASE}/api/demo/anpr-video`, { method:"POST", body: fd });
      if (!r.ok) { const t=await r.text(); let m=t; try{ m=JSON.parse(t).detail||t}catch{}; throw new Error(m); }
      setAnprVideoResult(await r.json());
    } catch(e:any){ setAnprVideoError(e.message||"ANPR video failed"); } finally{ setAnprVideoLoading(false); }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0f172a", color: "#fff", padding: "6px 14px", borderRadius: 999, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>MANUAL AI DEMO</div>
        <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>Urban Intelligence Platform — AI Demo</h1>
        <p style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>Evaluator Testing UI at localhost:5174 — ROAD CONDITION AI + VEHICLE SECURITY / ANPR</p>
        <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>Demo calls <code style={{ background: "#e2e8f0", padding: "1px 4px", borderRadius: 4 }}>{AI_BASE}/api/demo/*</code> — does NOT create incidents</p>
      </div>

      {/* ROAD CONDITION AI */}
      <div style={{ background: "#0f172a", color:"#fff", padding:"8px 14px", borderRadius:12, fontWeight:800, letterSpacing:1, fontSize:12, marginBottom:8 }}>ROAD CONDITION AI — Pothole / Damaged Road / Waterlogging</div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5 }}>MODEL / CONDITION</label>
          <select value={model} onChange={e => { setModel(e.target.value as ModelOpt); setResult(null); setError(null); }} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 14, background: "#fff" }}>
            <option value="pothole">Pothole</option>
            <option value="damaged_road">Damaged Road</option>
            <option value="waterlogging">Waterlogging</option>
          </select>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>Model: {modelIds[model]}</p>
          <div style={{ marginTop: 12, background: "#f0fdf4", border: `1px solid #bbf7d0`, borderRadius: 10, padding: 10, fontSize: 11, color: "#166534" }}>
            {model === "pothole" && "Uses YOLO pothole detector (EngJamesO/pothole-detector)."}
            {model === "damaged_road" && "Uses YOLOv11s road-damage detector (cvtechniques/road-damage-detection-yolov11)."}
            {model === "waterlogging" && "Uses SegFormer-B4 segmentation (emnaRa/dgs_segmentation) fine-tuned on FloodNet."}
          </div>
        </div>
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{ border: `2px dashed ${dragOver ? "#3b82f6" : "#cbd5e1"}`, background: dragOver ? "#eff6ff" : "#f8fafc", borderRadius: 12, padding: 18, textAlign: "center" }}
          >
            <p style={{ fontWeight: 700, fontSize: 14 }}>Upload a road image</p>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>JPG · JPEG · PNG · WEBP (max 5 MB) — drag & drop or choose</p>
            <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleSelect} style={{ display: "none" }} />
            <button onClick={() => inputRef.current?.click()} style={{ marginTop: 10, padding: "8px 16px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Choose Image</button>
            {file && <p style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>{file.name} — {(file.size / 1024).toFixed(1)} KB <button onClick={clear} style={{ marginLeft: 8, fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Clear</button></p>}
          </div>
          <button onClick={detect} disabled={!file || loading} style={{ width: "100%", marginTop: 12, padding: "12px 16px", borderRadius: 12, border: "none", background: !file || loading ? "#94a3b8" : "#0f172a", color: "#fff", fontWeight: 700, fontSize: 14, cursor: !file || loading ? "not-allowed" : "pointer" }}>
            {loading ? "Running AI detection..." : "🔍 RUN AI DETECTION"}
          </button>
          {error && <div style={{ marginTop: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 10, borderRadius: 10, fontSize: 12 }}>{error}</div>}
        </div>
      </div>

      {(preview || result) && (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 28px 1fr", gap: 12, alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: "#334155" }}>ORIGINAL IMAGE</div>
            <div style={{ aspectRatio: "16/10", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {preview ? <img src={preview} alt="original" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#64748b", fontSize: 12 }}>No image</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 20, color: "#94a3b8" }}>→</div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontWeight: 700, fontSize: 12, letterSpacing: 0.5, color: "#334155" }}>AI DETECTION RESULT</div>
            <div style={{ aspectRatio: "16/10", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
              {!result && !loading && <span style={{ color: "#64748b", fontSize: 12 }}>Run detection to see result</span>}
              {loading && <span style={{ color: "#e2e8f0", fontSize: 12 }}>Running {modelLabel[model]} model...</span>}
              {result && annotatedSrc && <img src={annotatedSrc} alt="annotated" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {result && !annotatedSrc && (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <p style={{ color: "#f8fafc", fontWeight: 700, fontSize: 13 }}>{result.detected ? "Detected" : "No road defect detected"}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{result.message || (result.detected ? "" : "Try another image or model.")}</p>
                </div>
              )}
              {result?.detected && <div style={{ position: "absolute", top: 8, left: 8, background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 999 }}>DETECTED</div>}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.5 }}>DETECTED CONDITION</div>
            <div style={{ fontWeight: 800, marginTop: 4, textTransform: "capitalize" }}>{result.detected ? modelLabel[model] : "—"}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{result.detected ? result.incident_type : "No defect"}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.5 }}>{result.incident_type === 'waterlogging' ? 'WATER COVERAGE' : 'CONFIDENCE'}</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{result.incident_type === 'waterlogging' && result.water_coverage !== undefined ? `${(result.water_coverage*100).toFixed(1)}%` : result.confidence ? `${(result.confidence*100).toFixed(1)}%` : '—'}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{result.incident_type === 'waterlogging' ? `coverage ${result.water_coverage}` : result.confidence ?? '—'}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.5 }}>{result.incident_type === 'waterlogging' ? 'WATER COVERAGE' : 'DETECTIONS'}</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{result.incident_type === 'waterlogging' ? `${(result.water_coverage*100).toFixed(1)}%` : (result.count ?? result.detections?.length ?? 0)}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{result.incident_type === 'waterlogging' ? 'segmentation mask' : `${result.detections?.length || 0} bbox`}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.5 }}>MODEL</div>
            <div style={{ fontWeight: 600, marginTop: 4, fontSize: 12, wordBreak: "break-all" }}>{result.model || modelIds[model]}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{result.model_configured === false ? "Not configured" : "Existing pretrained"}</div>
          </div>
        </div>
      )}

      {/* ============ VEHICLE SECURITY / ANPR ============ */}
      <div style={{ marginTop: 28, background: "#1e3a5f", color:"#fff", padding:"8px 14px", borderRadius:12, fontWeight:800, letterSpacing:1, fontSize:12 }}>VEHICLE SECURITY / ANPR — Plate Detection · OCR · Stolen Vehicle Check</div>
      <div style={{ marginTop:8, background:"#fffbeb", border:"1px solid #fcd34d", padding:"8px 12px", borderRadius:10, fontSize:11, color:"#92400e" }}>
        <b>Demo stolen registry — not a live police database.</b> Plates: AP39AB1234, TS09CD5678, AP37XY9999, MH12AB1234, DL01AB1234 &nbsp;|&nbsp; Model: <code>keremberke/yolov5n-license-plate</code> + EasyOCR &nbsp;|&nbsp; Hit-and-run: requires temporal tracking — not inferred from stolen plate.
      </div>

      {/* ANPR Image */}
      <div style={{ marginTop:12, background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:16 }}>
        <h3 style={{ fontSize:13, fontWeight:800, color:"#1e3a5f" }}>ANPR — Image (Single Plate Check)</h3>
        <p style={{ fontSize:11, color:"#64748b" }}>Upload an image with a visible license plate → YOLO bbox + crop → OCR → normalize → stolen lookup. Calls <code>POST /api/demo/anpr</code></p>
        <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ border:"2px dashed #cbd5e1", borderRadius:12, padding:14, textAlign:"center", background:"#f8fafc" }}>
            <input ref={anprInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>{onAnprFile(e.target.files?.[0]||null); e.target.value=""}} style={{display:"none"}} />
            <button onClick={()=>anprInputRef.current?.click()} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #1e3a5f", background:"#1e3a5f", color:"#fff", fontWeight:600, cursor:"pointer" }}>Choose Plate Image</button>
            <button onClick={loadDemoImage} style={{ marginLeft:8, padding:"8px 10px", borderRadius:10, border:"1px solid #f59e0b", background:"#fffbeb", color:"#92400e", fontWeight:700, cursor:"pointer", fontSize:12 }}>Load Stolen Vehicle Demo (AP39AB1234)</button>
            <span style={{marginLeft:6, fontSize:9, color:"#92400e", fontWeight:700}}>DEMO TEST ONLY — SYNTHETIC</span>
            {anprFile && <p style={{fontSize:11, marginTop:8}}>{anprFile.name}</p>}
            <button onClick={runAnprImage} disabled={!anprFile || anprLoading} style={{ marginTop:10, width:"100%", padding:"10px 14px", borderRadius:10, border:"none", background: !anprFile||anprLoading?"#94a3b8":"#0f172a", color:"#fff", fontWeight:700, cursor: !anprFile||anprLoading?"not-allowed":"pointer" }}>{anprLoading?"Detecting...":"🔍 Detect Number Plate (Real Pipeline)"}</button>
            {anprError && <div style={{marginTop:8, background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", padding:8, borderRadius:8, fontSize:11}}>{anprError}</div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <div style={{ background:"#0f172a", borderRadius:10, overflow:"hidden", aspectRatio:"16/10", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {anprPreview ? <img src={anprPreview} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{color:"#64748b",fontSize:11}}>Original</span>}
            </div>
            <div style={{ background:"#0f172a", borderRadius:10, overflow:"hidden", aspectRatio:"16/10", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
              {anprLoading ? <span style={{color:"#e2e8f0",fontSize:11}}>Running YOLO + OCR...</span> : anprAnnotatedSrc ? <img src={anprAnnotatedSrc} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : anprResult ? <span style={{color:"#94a3b8",fontSize:11}}>{anprResult.count===0?"No plate detected":"Plate crop annotated"}</span> : <span style={{color:"#64748b",fontSize:11}}>Annotated</span>}
            </div>
          </div>
        </div>
        {anprResult && (
          <div style={{ marginTop:12 }}>
            <div style={{ display:"flex", gap:12, fontSize:11, color:"#475569" }}><span>Plates: <b>{anprResult.count}</b></span><span>Unique: <b>{anprResult.unique_plates}</b></span><span>Stolen: <b style={{color: anprResult.stolen_count>0?"#dc2626":"#16a34a"}}>{anprResult.stolen_count}</b></span></div>
            {anprResult.plates?.length>0 ? anprResult.plates.map((p:any,i:number)=>{
              const isOcrFailed = p.status?.includes("OCR FAILED") || (!p.plate_normalized && !p.normalized_plate);
              const bg = p.stolen ? "#fef2f2" : isOcrFailed ? "#fffbeb" : "#f0fdf4";
              const border = p.stolen ? "#fecaca" : isOcrFailed ? "#fde68a" : "#bbf7d0";
              return (
              <div key={i} style={{ marginTop:8, background: bg, border:`1px solid ${border}`, borderRadius:10, padding:10, fontSize:12 }}>
                {p.stolen && <div style={{background:"#dc2626", color:"#fff", padding:"4px 8px", borderRadius:6, fontWeight:800, fontSize:11, marginBottom:8}}>🚨 STOLEN VEHICLE — Registry: DEMO STOLEN VEHICLE REGISTRY — NOT A LIVE POLICE DATABASE — Priority: CRITICAL</div>}
                {isOcrFailed && !p.stolen && <div style={{background:"#f59e0b", color:"#fff", padding:"4px 8px", borderRadius:6, fontWeight:700, fontSize:11, marginBottom:8}}>⚠️ PLATE DETECTED — OCR FAILED / UNREADABLE</div>}
                {!isOcrFailed && !p.stolen && <div style={{background:"#16a34a", color:"#fff", padding:"4px 8px", borderRadius:6, fontWeight:700, fontSize:11, marginBottom:8}}>✅ PLATE DETECTED — OCR SUCCESS — CLEAR / NORMAL</div>}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                  <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>PLATE (OCR)</div><div style={{fontWeight:800, fontSize:14}}>{p.plate_normalized||p.normalized_plate||p.plate_text||"—"}</div><div style={{fontSize:10, color:"#64748b"}}>raw: {p.plate_text||p.ocr_text||"—"}</div></div>
                  <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>DETECTOR CONF</div><div style={{fontWeight:700}}>{(p.confidence*100).toFixed(1)}%</div><div style={{fontSize:10, color:"#64748b"}}>bbox {JSON.stringify(p.bbox)}</div></div>
                  <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>OCR CONF</div><div style={{fontWeight:700}}>{p.ocr_confidence? (p.ocr_confidence*100).toFixed(1)+"%":"—"}</div></div>
                  <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>STATUS</div><div style={{fontWeight:800, color: p.stolen?"#dc2626": isOcrFailed?"#d97706":"#16a34a"}}>{p.status}</div></div>
                  <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>PRIORITY</div><div style={{fontWeight:700}}>{p.priority}</div><div style={{fontSize:9, color:"#64748b"}}>DEMO REGISTRY</div></div>
                </div>
              </div>
            )}) : <div style={{marginTop:8, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:10, fontSize:12, textAlign:"center"}}>NO PLATE DETECTED — YOLO found no license plate in this image.</div>}
          </div>
        )}
      </div>

      {/* ANPR Video */}
      <div style={{ marginTop:12, background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:16 }}>
        <h3 style={{ fontSize:13, fontWeight:800, color:"#1e3a5f" }}>ANPR — Video (Sampled Frames)</h3>
        <p style={{ fontSize:11, color:"#64748b" }}>Upload a video with visible plates → sampled every 3s → YOLO per frame → OCR → stolen check. Calls <code>POST /api/demo/anpr-video</code></p>
        <div style={{ marginTop:10, border:"2px dashed #cbd5e1", borderRadius:12, padding:14, textAlign:"center", background:"#f8fafc" }}>
          <input ref={anprVideoInputRef} type="file" accept=".mp4,.mov,.avi,.mkv,.webm" onChange={e=>{onAnprVideoFile(e.target.files?.[0]||null); e.target.value=""}} style={{display:"none"}} />
          <button onClick={()=>anprVideoInputRef.current?.click()} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #1e3a5f", background:"#fff", color:"#1e3a5f", fontWeight:600, cursor:"pointer" }}>Choose Video</button>
          <button onClick={loadDemoVideo} style={{ marginLeft:8, padding:"8px 10px", borderRadius:10, border:"1px solid #f59e0b", background:"#fffbeb", color:"#92400e", fontWeight:700, cursor:"pointer", fontSize:12 }}>Load Stolen Vehicle Demo Video (AP39AB1234)</button>
          <span style={{marginLeft:6, fontSize:9, color:"#92400e", fontWeight:700}}>DEMO TEST ONLY — SYNTHETIC</span>
          {anprVideoFile && <span style={{marginLeft:10, fontSize:11}}>{anprVideoFile.name} — {(anprVideoFile.size/1024/1024).toFixed(2)} MB</span>}
          <div style={{ marginTop:10 }}>
            <button onClick={runAnprVideo} disabled={!anprVideoFile || anprVideoLoading} style={{ padding:"10px 22px", borderRadius:10, border:"none", background: !anprVideoFile||anprVideoLoading?"#94a3b8":"#1e3a5f", color:"#fff", fontWeight:700, cursor: !anprVideoFile||anprVideoLoading?"not-allowed":"pointer" }}>{anprVideoLoading?"Detecting... (processing frames)":"🎬 RUN ANPR (VIDEO) — Sampled 3s"}</button>
          </div>
          {anprVideoError && <div style={{marginTop:8, background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b", padding:8, borderRadius:8, fontSize:11}}>{anprVideoError}</div>}
        </div>
        {anprVideoResult && (
          <div style={{ marginTop:12 }}>
            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:10, fontSize:12, display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
              <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>FRAMES CHECKED</div><div style={{fontWeight:800}}>{anprVideoResult.frames_checked ?? anprVideoResult.frames_sampled}</div><div style={{fontSize:10,color:"#64748b"}}>interval {anprVideoResult.interval_sec}s</div></div>
              <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>PLATES DETECTED</div><div style={{fontWeight:800}}>{anprVideoResult.all_plates?.length ?? anprVideoResult.per_frame?.reduce((a:number,f:any)=>a+(f.count||0),0) ?? 0}</div><div style={{fontSize:10,color:"#64748b"}}>{anprVideoResult.all_plates?.length ?? 0} bbox</div></div>
              <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>UNIQUE PLATES</div><div style={{fontWeight:800}}>{anprVideoResult.unique_plates}</div><div style={{fontSize:10,color:"#64748b"}}>readable only</div></div>
              <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>STOLEN VEHICLES</div><div style={{fontWeight:800, color: anprVideoResult.stolen_vehicles>0?"#dc2626":"#16a34a"}}>{anprVideoResult.stolen_vehicles}</div><div style={{fontSize:10,color:"#64748b"}}>{anprVideoResult.stolen_list?.join(", ")||"—"}</div></div>
              <div><div style={{fontSize:10, color:"#64748b", fontWeight:700}}>DURATION / FPS</div><div style={{fontWeight:700}}>{anprVideoResult.duration?.toFixed?.(1) ?? anprVideoResult.duration}s / {anprVideoResult.fps?.toFixed?.(0)}</div><div style={{fontSize:10,color:"#64748b"}}>total {anprVideoResult.total_frames}</div></div>
            </div>
            {(anprVideoResult.all_plates || anprVideoResult.stolen_list) && (
              <div style={{marginTop:10, background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:8, fontSize:11}}>
                <div style={{fontWeight:700}}>Unique plates: {anprVideoResult.unique_plate_list?.join(", ") || anprVideoResult.stolen_list?.join(", ") || "—"} </div>
                <div style={{marginTop:4}}>{anprVideoResult.stolen_list?.length>0 ? anprVideoResult.stolen_list.map((s:string)=>(<span key={s} style={{background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626", padding:"2px 6px", borderRadius:6, marginRight:6, fontWeight:700}}>🚨 {s} — STOLEN — CRITICAL</span>)) : <span style={{color:"#16a34a"}}>No stolen plates</span>}</div>
                <div style={{marginTop:6, fontSize:10, color:"#64748b"}}>Hit-and-run analysis requires vehicle tracking + collision/action evidence and is not configured. A stolen vehicle is NOT automatically a hit-and-run vehicle.</div>
              </div>
            )}
            <div style={{ marginTop:10, fontSize:11, fontWeight:700 }}>Per-frame results (3 states: NO PLATE DETECTED vs PLATE DETECTED — OCR FAILED vs PLATE DETECTED — OCR SUCCESS):</div>
            <div style={{ maxHeight:340, overflowY:"auto", marginTop:6, display:"grid", gap:6 }}>
              {anprVideoResult.per_frame?.map((fr:any,i:number)=>{
                const hasPlates = fr.count>0 && fr.plates?.length>0;
                const hasOcrFailed = hasPlates && fr.plates.some((p:any)=> p.status?.includes("OCR FAILED") || (!p.plate_normalized && !p.normalized_plate));
                const hasOcrSuccess = hasPlates && fr.plates.some((p:any)=> (p.plate_normalized||p.normalized_plate) && !p.status?.includes("OCR FAILED"));
                let header = "NO PLATE DETECTED";
                let headerColor="#64748b";
                if (hasPlates && hasOcrFailed && !hasOcrSuccess) { header="PLATE DETECTED — OCR FAILED"; headerColor="#d97706"; }
                else if (hasPlates && hasOcrSuccess) { header="PLATE DETECTED — OCR SUCCESS"; headerColor="#16a34a"; }
                else if (hasPlates) { header="PLATE DETECTED"; headerColor="#16a34a"; }
                return (
                <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:8, fontSize:11 }}>
                  <div style={{ fontWeight:800 }}>Frame {fr.frame_number} @ {fr.timestamp}s — <span style={{color: headerColor}}>{header}</span> {hasPlates? `(${fr.count} plate(s))`:""}</div>
                  {hasPlates ? fr.plates.map((p:any,j:number)=>{
                    const isOcrFailed = p.status?.includes("OCR FAILED") || (!p.plate_normalized && !p.normalized_plate);
                    return (
                    <div key={j} style={{ marginTop:6, padding:8, background: p.stolen?"#fef2f2": isOcrFailed?"#fffbeb":"#f0fdf4", border:`1px solid ${p.stolen?"#fecaca": isOcrFailed?"#fde68a":"#bbf7d0"}`, borderRadius:6 }}>
                      <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr 1fr", gap:6}}>
                        <span><b>{p.plate_normalized||p.normalized_plate|| (isOcrFailed?"— (unreadable)":"—")}</b> <span style={{color:"#64748b", fontSize:10}}>raw:{p.plate_text||p.ocr_text||"—"}</span></span>
                        <span>Det: {(p.confidence*100).toFixed(1)}%<br/><span style={{fontSize:9, color:"#64748b"}}>bbox {JSON.stringify(p.bbox)}</span></span>
                        <span>OCR: {p.ocr_confidence? (p.ocr_confidence*100).toFixed(1)+"%":"unavailable"}<br/><span style={{fontSize:9, color:"#64748b"}}>{isOcrFailed?"unreadable":""}</span></span>
                        <span style={{ color: p.stolen?"#dc2626": isOcrFailed?"#d97706":"#16a34a", fontWeight:800 }}>{p.stolen?"🚨 STOLEN — CRITICAL": isOcrFailed?"⚠️ OCR FAILED":`✅ ${p.status}` }<br/><span style={{fontSize:9}}>{p.priority} | {p.stolen?"DEMO REGISTRY":""}</span></span>
                      </div>
                    </div>
                    )}) : <div style={{marginTop:4, padding:6, background:"#f8fafc", borderRadius:6, color:"#64748b", textAlign:"center"}}>NO PLATE DETECTED — YOLO found no plate in this sampled frame.</div>}
                </div>
              )})}
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: "center", fontSize: 10, color: "#94a3b8", marginTop: 16 }}>ANPR model cached once → reused per frame · OCR via EasyOCR (fallback PaddleOCR/TrOCR) · Demo stolen registry only</p>
    </div>
  );
}
