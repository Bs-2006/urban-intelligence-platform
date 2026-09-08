import { useState, useEffect } from 'react'
import './App.css'

const API = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8001'
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function App() {
  // ROAD CONDITION
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [model, setModel] = useState('pothole')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [videoInterval, setVideoInterval] = useState(3)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoResult, setVideoResult] = useState(null)
  const [busId, setBusId] = useState('BVR-101')
  const [routeId, setRouteId] = useState('BVR001')
  const [pipelineSending, setPipelineSending] = useState(false)
  const [pipelineResult, setPipelineResult] = useState(null)

  // ANPR
  const [anprFile, setAnprFile] = useState(null)
  const [anprPreview, setAnprPreview] = useState(null)
  const [anprIsVideo, setAnprIsVideo] = useState(false)
  const [anprLoading, setAnprLoading] = useState(false)
  const [anprResult, setAnprResult] = useState(null)
  const [anprInterval, setAnprInterval] = useState(3)

  useEffect(()=>{return()=>{ if(preview) URL.revokeObjectURL(preview); if(anprPreview) URL.revokeObjectURL(anprPreview)}},[preview,anprPreview])

  const onFile = (f)=>{
    if(!f) return
    const ext=f.name.split('.').pop()?.toLowerCase()
    if(!['jpg','jpeg','png','webp'].includes(ext||'')){ setError('Use JPG/PNG/WEBP'); return}
    if(f.size>5*1024*1024){ setError('Max 5 MB'); return}
    setError(null); setResult(null)
    if(preview) URL.revokeObjectURL(preview)
    setFile(f); setPreview(URL.createObjectURL(f))
  }
  const onAnprFile=(f)=>{
    if(!f) return
    const ext=f.name.split('.').pop()?.toLowerCase()
    const isVid=['mp4','mov','avi','mkv','webm'].includes(ext||'')
    const isImg=['jpg','jpeg','png','webp'].includes(ext||'')
    if(!isVid&&!isImg){ setError('ANPR: use image or mp4'); return}
    if(anprPreview) URL.revokeObjectURL(anprPreview)
    setAnprFile(f); setAnprPreview(URL.createObjectURL(f)); setAnprIsVideo(isVid); setAnprResult(null)
  }
  const analyzeImage=async()=>{
    if(!file) return
    setLoading(true); setError(null); setResult(null)
    try{
      const fd=new FormData(); fd.append('file',file); fd.append('model',model)
      const resp=await fetch(`${API}/api/demo/detect`,{method:'POST',body:fd})
      if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
      const data=await resp.json(); setResult(data)
    }catch(e){ setError(e.message)} finally{ setLoading(false)}
  }
  const analyzeVideo=async()=>{
    if(!videoFile) return
    setVideoLoading(true); setError(null); setVideoResult(null)
    try{
      const fd=new FormData(); fd.append('file',videoFile); fd.append('model',model); fd.append('interval',String(videoInterval))
      const resp=await fetch(`${API}/api/demo/detect-video`,{method:'POST',body:fd})
      if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
      const data=await resp.json(); setVideoResult(data)
    }catch(e){ setError(e.message)} finally{ setVideoLoading(false)}
  }
  const sendVideoPipeline=async()=>{
    if(!videoFile) return
    setPipelineSending(true); setError(null); setPipelineResult(null)
    try{
      const fd=new FormData(); fd.append('file',videoFile); fd.append('bus_id',busId); fd.append('route_id',routeId); fd.append('interval',String(videoInterval))
      const resp=await fetch(`${API}/api/demo/video-to-pipeline`,{method:'POST',body:fd})
      if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
      const data=await resp.json(); setPipelineResult(data)
    }catch(e){ setError(e.message)} finally{ setPipelineSending(false)}
  }
  const sendImagePipeline=async()=>{
    if(!file) return
    setPipelineSending(true); setError(null); setPipelineResult(null)
    try{
      const fd=new FormData()
      fd.append('bus_id',busId); fd.append('route_id',routeId); fd.append('latitude','16.5449'); fd.append('longitude','81.5212'); fd.append('location_name','Manual Demo Upload'); fd.append('occurred_at',new Date().toISOString()); fd.append('image',file,file.name)
      const resp=await fetch(`${BACKEND}/api/bus-observations`,{method:'POST',body:fd})
      if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
      const data=await resp.json(); setPipelineResult({single:data, count:1})
    }catch(e){ setError(e.message)} finally{ setPipelineSending(false)}
  }
  const detectANPR=async()=>{
    if(!anprFile) return
    setAnprLoading(true); setError(null); setAnprResult(null)
    try{
      if(anprIsVideo){
        const fd=new FormData(); fd.append('file',anprFile); fd.append('interval',String(anprInterval))
        const resp=await fetch(`${API}/api/demo/anpr-video`,{method:'POST',body:fd})
        if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
        const data=await resp.json(); setAnprResult({...data, isVideo:true})
      } else {
        const fd=new FormData(); fd.append('file',anprFile)
        const resp=await fetch(`${API}/api/demo/anpr`,{method:'POST',body:fd})
        if(!resp.ok){ const t=await resp.text(); throw new Error(t)}
        const data=await resp.json(); setAnprResult({...data, isVideo:false})
      }
    }catch(e){ setError(e.message)} finally{ setAnprLoading(false)}
  }

  const annotatedSrc = result?.annotated_image_base64 ? `data:image/jpeg;base64,${result.annotated_image_base64}` : result?.annotated_image_url ? `${API}${result.annotated_image_url}` : null
  const anprAnnotated = anprResult?.annotated_image_base64 ? `data:image/jpeg;base64,${anprResult.annotated_image_base64}` : anprResult?.annotated_image_url ? `${API}${anprResult.annotated_image_url}` : null

  return (
    <div style={{maxWidth:1150, margin:'20px auto', fontFamily:'system-ui', padding:16}}>
      <div style={{textAlign:'center'}}>
        <div style={{display:'inline-block', background:'#0f172a', color:'#fff', padding:'4px 12px', borderRadius:999, fontSize:11, fontWeight:700}}>URBAN INTELLIGENCE PLATFORM — AI TESTING FRONTEND</div>
        <h1 style={{marginTop:10, fontSize:24, fontWeight:800}}>AI Demo — Road Condition & Vehicle Security</h1>
        <p style={{color:'#64748b', fontSize:12}}>AI: {API} | Backend: {BACKEND}/api/bus-observations → PostgreSQL → AI worker → Dashboard :5173</p>
      </div>

      {/* ROAD CONDITION */}
      <div style={{marginTop:16, background:'#fff', border:'1px solid #e2e8f0', borderRadius:16, padding:16}}>
        <h2 style={{margin:0, fontSize:16, fontWeight:800, color:'#0f172a'}}>ROAD CONDITION AI</h2>
        <p style={{fontSize:11, color:'#64748b'}}>Image + Video upload · Model selection · Analyze (no DB) · Send to Bus Camera Pipeline (via BusObservation)</p>

        <div style={{display:'grid', gridTemplateColumns:'260px 1fr', gap:16, marginTop:12}}>
          <div>
            <label style={{fontSize:11, fontWeight:700, color:'#475569'}}>MODEL / CONDITION</label>
            <select value={model} onChange={e=>setModel(e.target.value)} style={{width:'100%', marginTop:6, padding:'10px', borderRadius:10, border:'1px solid #cbd5e1'}}>
              <option value="pothole">Pothole — EngJamesO/pothole-detector</option>
              <option value="damaged_road">Damaged Road — cvtechniques/road-damage-detection-yolov11</option>
              <option value="waterlogging">Waterlogging — openai/clip-vit-base-patch32</option>
            </select>
            <div style={{marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              <div><label style={{fontSize:10}}>BUS ID</label><input value={busId} onChange={e=>setBusId(e.target.value)} style={{width:'100%', padding:6, border:'1px solid #cbd5e1', borderRadius:8}} /></div>
              <div><label style={{fontSize:10}}>ROUTE ID</label><input value={routeId} onChange={e=>setRouteId(e.target.value)} style={{width:'100%', padding:6, border:'1px solid #cbd5e1', borderRadius:8}} /></div>
            </div>
            <div style={{marginTop:8}}><label style={{fontSize:10}}>SAMPLING INTERVAL (sec)</label>
              <select value={videoInterval} onChange={e=>setVideoInterval(Number(e.target.value))} style={{width:'100%', padding:6, border:'1px solid #cbd5e1', borderRadius:8}}>
                <option value={1}>1s (more frames)</option><option value={2}>2s</option><option value={3}>3s (default)</option><option value={5}>5s (fewer)</option>
              </select>
              <div style={{fontSize:10,color:'#94a3b8', marginTop:4}}>30s video @3s ≈ 10 frames (OpenCV VideoCapture)</div>
            </div>
          </div>

          <div>
            {/* Image upload */}
            <div style={{border:'2px dashed #cbd5e1', background:'#f8fafc', borderRadius:12, padding:14, textAlign:'center'}}>
              <b style={{fontSize:13}}>Upload a road image</b> <span style={{fontSize:11,color:'#94a3b8'}}>JPG/PNG/WEBP ≤5MB</span>
              <div style={{marginTop:8}}><input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>onFile(e.target.files?.[0])} />
                {file && <span style={{fontSize:11, marginLeft:8}}>{file.name} <button onClick={()=>{setFile(null); setPreview(null); setResult(null)}} style={{color:'#ef4444', border:'none', background:'none'}}>Clear</button></span>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
                <button onClick={analyzeImage} disabled={!file||loading} style={{padding:10, borderRadius:10, border:'none', background:!file||loading?'#94a3b8':'#0f172a', color:'#fff', fontWeight:700, cursor:'pointer'}}>{loading?'Running...':'🔍 ANALYZE IMAGE'}</button>
                <button onClick={sendImagePipeline} disabled={!file||pipelineSending} style={{padding:10, borderRadius:10, border:'1px solid #0f172a', background:'#fff', fontWeight:700, cursor:'pointer'}}>{pipelineSending?'Sending...':'🚌 SEND IMAGE TO PIPELINE'}</button>
              </div>
            </div>

            {/* Video upload */}
            <div style={{border:'2px dashed #93c5fd', background:'#eff6ff', borderRadius:12, padding:14, textAlign:'center', marginTop:10}}>
              <b style={{fontSize:13}}>Upload a road video (MP4)</b> <span style={{fontSize:11,color:'#64748b'}}>30s → ~10 frames at 3s interval</span>
              <div style={{marginTop:8}}><input type="file" accept=".mp4,.mov,.avi,.mkv,.webm" onChange={e=>setVideoFile(e.target.files?.[0]||null)} />
                {videoFile && <span style={{fontSize:11, marginLeft:8}}>{videoFile.name} {(videoFile.size/1024/1024).toFixed(1)} MB</span>}
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10}}>
                <button onClick={analyzeVideo} disabled={!videoFile||videoLoading} style={{padding:10, borderRadius:10, border:'none', background:!videoFile||videoLoading?'#94a3b8':'#2563eb', color:'#fff', fontWeight:700, cursor:'pointer'}}>{videoLoading?'Analyzing...':'[Upload Video] [Analyze Video]'}</button>
                <button onClick={sendVideoPipeline} disabled={!videoFile||pipelineSending} style={{padding:10, borderRadius:10, border:'1px solid #2563eb', background:'#fff', color:'#2563eb', fontWeight:700, cursor:'pointer'}}>{pipelineSending?'Sending...':'[Send Video To Bus Camera Pipeline]'}</button>
              </div>
              <div style={{fontSize:10,color:'#64748b', marginTop:6}}>Analyze = no DB · Send = sampled frames → POST /api/bus-observations → AI worker → dashboard</div>
            </div>
          </div>
        </div>

        {error && <div style={{marginTop:10, background:'#fef2f2', border:'1px solid #fecaca', padding:10, borderRadius:10, fontSize:12, color:'#991b1b'}}>{error}</div>}
        {pipelineResult && <div style={{marginTop:10, background:'#f0fdf4', border:'1px solid #bbf7d0', padding:10, borderRadius:10, fontSize:11, color:'#166534'}}>
          <b>Pipeline sent:</b> {pipelineResult.count ?? pipelineResult.sent?.length} frames — <a href="http://localhost:5173/ai-monitoring" target="_blank" rel="noreferrer">Dashboard :5173/ai-monitoring</a>
          <pre style={{whiteSpace:'pre-wrap', fontSize:10, marginTop:6}}>{JSON.stringify(pipelineResult).slice(0,1200)}</pre>
        </div>}
        {preview && (
          <div style={{marginTop:12, display:'grid', gridTemplateColumns:'1fr 24px 1fr', gap:12}}>
            <div><div style={{fontSize:11, fontWeight:700}}>ORIGINAL</div><img src={preview} style={{width:'100%', maxHeight:260, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0'}} /></div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'center'}}>→</div>
            <div><div style={{fontSize:11, fontWeight:700}}>AI RESULT {result?.detected ? '✅ DETECTED' : result ? '— NO DETECTION' : ''}</div>
              {annotatedSrc ? <img src={annotatedSrc} style={{width:'100%', maxHeight:260, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0'}} /> : <div style={{height:160, background:'#0f172a', color:'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10, fontSize:12}}>{result ? JSON.stringify({detected:result.detected, confidence:result.confidence, model:result.model}).slice(0,400) : 'Run ANALYZE'}</div>}
              {result && <div style={{fontSize:11, marginTop:6, background:'#f8fafc', padding:8, borderRadius:8, border:'1px solid #e2e8f0'}}>
                <b>{result.incident_type}</b> {result.incident_type==='waterlogging' ? `Waterlogging confidence: ${( (result.water_score ?? result.confidence)*100).toFixed(1)}%` : `conf ${(result.confidence*100).toFixed(1)}% — ${result.detections?.length||0} bbox`}
                {result.incident_type==='waterlogging' && <div style={{fontSize:10, color:'#64748b', marginTop:4}}>Zero-shot CLIP classification — no segmentation mask</div>}
              </div>}
            </div>
          </div>
        )}
        {videoResult && (
          <div style={{marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <div style={{background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:12}}>
              <b style={{fontSize:12, color:'#14532d'}}>ROAD INCIDENTS</b>
              <div style={{fontSize:12, marginTop:6}}>Duration: {Math.floor((videoResult.road?.duration ?? videoResult.duration)/60).toString().padStart(2,'0')}:{((videoResult.road?.duration ?? videoResult.duration)%60).toFixed(0).padStart(2,'0')} · Frames sampled: {videoResult.road?.frames_sampled ?? videoResult.frames_sampled}</div>
              <div style={{fontSize:13, marginTop:8}}>Potholes: <b>{videoResult.road?.pothole_detections ?? videoResult.counts?.pothole}</b> · Damaged Roads: <b>{videoResult.road?.damaged_road_detections ?? videoResult.counts?.damaged_road}</b> · Waterlogging: <b>{videoResult.road?.waterlogging_detections ?? videoResult.counts?.waterlogging}</b></div>
              <div style={{fontSize:10, color:'#64748b', marginTop:4}}>Pothole: EngJamesO/pothole-detector · Damaged: cvtechniques/road-damage-detection-yolov11 · Waterlogging: openai/clip-vit-base-patch32 (Zero-shot CLIP classification — no segmentation mask)</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px,1fr))', gap:6, marginTop:10}}>
                {videoResult.per_frame?.slice(0,8).map((fr,i)=>(
                  <div key={i} style={{border:'1px solid #bbf7d0', borderRadius:8, overflow:'hidden', background:'#fff', fontSize:10}}>
                    <div style={{padding:'3px 6px', background: (fr.road?.pothole?.detected||fr.road?.damaged_road?.detected||fr.road?.waterlogging?.detected) ? '#dcfce7':'#f1f5f9', fontWeight:700}}>Frame {fr.frame_number} @ {fr.timestamp}s</div>
                    <div style={{padding:4}}>{fr.road?.pothole?.detected ? `Pothole ${fr.road.pothole.confidence}`:''} {fr.road?.damaged_road?.detected ? `· Damaged ${fr.road.damaged_road.confidence}`:''} {fr.road?.waterlogging?.detected ? `· Water ${fr.road.waterlogging.water_score}`:''} {!fr.road?.pothole?.detected&&!fr.road?.damaged_road?.detected&&!fr.road?.waterlogging?.detected ? 'no road incident':''}</div>
                    {fr.annotated_image_base64 ? <img src={`data:image/jpeg;base64,${fr.annotated_image_base64}`} style={{width:'100%', height:80, objectFit:'cover'}} /> : null}
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:12}}>
              <b style={{fontSize:12, color:'#9a3412'}}>VEHICLE SECURITY</b>
              <div style={{fontSize:12, marginTop:6}}>Frames checked: <b>{videoResult.vehicle_security?.frames_checked ?? videoResult.frames_sampled}</b> · Vehicles/plates detected: <b>{videoResult.vehicle_security?.vehicles_detected ?? 0}</b> · Unique plates: <b>{videoResult.vehicle_security?.unique_plates ?? 0}</b> · Stolen vehicles: <b>{videoResult.vehicle_security?.stolen_vehicles ?? 0}</b></div>
              {(videoResult.vehicle_security?.stolen_vehicles ?? 0)>0 ? <div style={{marginTop:8, background:'#dc2626', color:'#fff', padding:8, borderRadius:8, fontWeight:800, fontSize:12}}>🚨 STOLEN VEHICLE DETECTED — {videoResult.vehicle_security.stolen_list.join(', ')}</div> : <div style={{marginTop:8, fontSize:11, color:'#16a34a'}}>{(videoResult.vehicle_security?.vehicles_detected ?? 0)===0 ? 'No plates detected in sampled frames' : 'No stolen vehicles'}</div>}
              {videoResult.vehicle_security?.stolen_details?.length>0 && <div style={{marginTop:8}}>
                {videoResult.vehicle_security.stolen_details.slice(0,3).map((p,i)=>(
                  <div key={i} style={{fontSize:11, background:'#fef2f2', border:'1px solid #fecaca', padding:6, borderRadius:8, marginTop:6}}>Plate: <b>{p.plate_normalized}</b> · Det {(p.confidence*100).toFixed(0)}% · OCR {(p.ocr_confidence*100).toFixed(0)}% · Frame {p.frame_number} · Status CRITICAL</div>
                ))}
              </div>}
              <div style={{fontSize:10, color:'#9a3412', marginTop:8, background:'#ffedd5', padding:6, borderRadius:6}}>{videoResult.hit_and_run || videoResult.vehicle_security?.hit_and_run || 'Hit-and-run analysis: vehicle tracking/collision evidence model not configured'}</div>
              <details style={{marginTop:8, fontSize:10}}><summary>Per-frame plates ({videoResult.per_frame?.length} frames)</summary>
                {videoResult.per_frame?.map((fr,i)=>(
                  <div key={i} style={{padding:'4px 0', borderBottom:'1px solid #ffedd5'}}>Frame {fr.frame_number} @ {fr.timestamp}s: {fr.plates?.length ? fr.plates.map(pp=>`${pp.plate_normalized||pp.plate_text||'—'} (${(pp.confidence*100).toFixed(0)}%/${(pp.ocr_confidence*100).toFixed(0)}% ${pp.stolen?'🚨STOLEN':''})`).join(' | ') : '— no plate'}</div>
                ))}
              </details>
            </div>
          </div>
        )}
      </div>

      {/* VEHICLE SECURITY / ANPR */}
      <div style={{marginTop:16, background:'#fff', border:'2px solid #f97316', borderRadius:16, padding:16}}>
        <h2 style={{margin:0, fontSize:16, fontWeight:800, color:'#9a3412'}}>🚗 VEHICLE SECURITY / ANPR</h2>
        <p style={{fontSize:11, color:'#64748b'}}>License plate detector <code>keremberke/yolov5n-license-plate</code> → crop → OCR (PaddleOCR/EasyOCR) → normalize → stolen lookup</p>
        <div style={{marginTop:10, border:'2px dashed #fed7aa', background:'#fff7ed', borderRadius:12, padding:14, textAlign:'center'}}>
          <b style={{fontSize:13}}>Upload plate image or video</b> <span style={{fontSize:11,color:'#9a3412'}}>1 frame / 3s for video</span>
          <div style={{marginTop:8}}>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,.mkv,.webm" onChange={e=>onAnprFile(e.target.files?.[0])} />
            {anprFile && <span style={{fontSize:11, marginLeft:8}}>{anprFile.name} {anprIsVideo?'(video)':''}</span>}
            <span style={{marginLeft:12, fontSize:11}}>Interval: <select value={anprInterval} onChange={e=>setAnprInterval(Number(e.target.value))}><option value={2}>2s</option><option value={3}>3s</option><option value={5}>5s</option></select></span>
          </div>
          <button onClick={detectANPR} disabled={!anprFile||anprLoading} style={{marginTop:10, padding:'10px 18px', borderRadius:10, border:'none', background:!anprFile||anprLoading?'#94a3b8':'#ea580c', color:'#fff', fontWeight:800, cursor:'pointer'}}>{anprLoading?'Detecting...':'🔍 Detect Number Plate'}</button>
        </div>

        {anprPreview && !anprIsVideo && <div style={{marginTop:10, display:'grid', gridTemplateColumns:'1fr 24px 1fr', gap:12}}><div><div style={{fontSize:11,fontWeight:700}}>ORIGINAL</div><img src={anprPreview} style={{width:'100%', maxHeight:240, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0'}}/></div><div style={{display:'flex', alignItems:'center', justifyContent:'center'}}>→</div><div><div style={{fontSize:11,fontWeight:700}}>ANNOTATED</div>{anprAnnotated?<img src={anprAnnotated} style={{width:'100%', maxHeight:240, objectFit:'cover', borderRadius:10, border:'1px solid #e2e8f0'}}/>:<div style={{height:160, background:'#0f172a', color:'#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:10}}>{anprResult? 'No plate detected' : 'Run detection'}</div>}</div></div>}

        {anprResult && !anprResult.isVideo && (
          <div style={{marginTop:12}}>
            {anprResult.plates?.length===0 ? <div style={{background:'#f0fdf4', border:'1px solid #bbf7d0', padding:12, borderRadius:10, textAlign:'center'}}><b>No plate detected</b></div> :
              anprResult.plates.map((p,i)=>{
                const norm = p.normalized_plate ?? p.plate_normalized ?? ''
                const readable = norm && norm.trim()!==''
                const theft = !readable ? 'UNKNOWN' : (p.stolen ? '🚨 YES' : '❌ NO')
                return (
                <div key={i} style={{marginTop:8, border: p.stolen ? '2px solid #ef4444':'1px solid #e2e8f0', background: p.stolen ? '#fef2f2':'#f8fafc', borderRadius:12, padding:12}}>
                  {!readable && <div style={{background:'#f59e0b', color:'#fff', padding:'4px 8px', borderRadius:6, fontWeight:700, textAlign:'center', marginBottom:8}}>PLATE DETECTED — OCR UNREADABLE</div>}
                  <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, fontSize:11}}>
                    <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>NUMBER PLATE</div><div style={{fontWeight:800, fontSize:16}}>{readable ? norm : 'OCR UNREADABLE'}</div><div style={{color:'#64748b'}}>raw: {p.plate_text || p.ocr_text || '—'}</div></div>
                    <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>THEFT / STOLEN VEHICLE</div><div style={{fontWeight:800, fontSize:14}}>{theft}</div></div>
                    <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>STATUS</div><div style={{fontWeight:800, color: p.stolen ? '#dc2626':'#16a34a'}}>{p.status}</div></div>
                    <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>PRIORITY</div><div style={{fontSize:10, background: p.priority==='CRITICAL'?'#dc2626':'#16a34a', color:'#fff', display:'inline-block', padding:'2px 8px', borderRadius:999}}>{p.priority}</div></div>
                    <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>Bounding box</div><div style={{fontFamily:'monospace', fontSize:10}}>{p.bbox ? `[${p.bbox.join(', ')}]`:'—'}</div></div>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:11, marginTop:8, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:8}}>
                    <div>Detector confidence: <b>{( (p.detector_confidence ?? p.confidence)*100).toFixed(1)}%</b></div>
                    <div>OCR confidence: <b>{p.ocr_confidence!=null ? (p.ocr_confidence*100).toFixed(1)+'%':'—'}</b></div>
                  </div>
                  {p.stolen && readable && <div style={{marginTop:8, background:'#dc2626', color:'#fff', padding:8, borderRadius:8, textAlign:'center', fontWeight:800}}>🚨 STOLEN VEHICLE — {norm} — DEMO STOLEN VEHICLE REGISTRY ⚠️ NOT A LIVE POLICE DATABASE</div>}
                </div>
              )})}
            <div style={{fontSize:10, color:'#94a3b8', marginTop:8}}>Registry: {anprResult.registry?.join(', ')}</div>
          </div>
        )}
        {anprResult?.isVideo && (
          <div style={{marginTop:12, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:12, padding:12}}>
            {(() => {
              const perFrame = anprResult.per_frame || []
              const platesDetected = perFrame.reduce((a,f)=>a + (f.plates?.length||0),0)
              const allPlates = perFrame.flatMap(f=>f.plates||[])
              const uniqueSet = new Set(allPlates.map(p=> p.normalized_plate || p.plate_normalized).filter(v=>v && v.trim()!==''))
              const stolenSet = new Set(allPlates.filter(p=>p.stolen && (p.normalized_plate||p.plate_normalized)).map(p=> p.normalized_plate || p.plate_normalized))
              return (
              <>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, background:'#fff', border:'1px solid #fed7aa', borderRadius:10, padding:10}}>
                  <div><div style={{fontSize:10, fontWeight:700, color:'#9a3412'}}>Frames checked</div><div style={{fontWeight:800, fontSize:16}}>{anprResult.frames_checked ?? anprResult.frames_sampled}</div></div>
                  <div><div style={{fontSize:10, fontWeight:700, color:'#9a3412'}}>Plates detected</div><div style={{fontWeight:800, fontSize:16}}>{platesDetected}</div><div style={{fontSize:10, color:'#64748b'}}>sum plates.length</div></div>
                  <div><div style={{fontSize:10, fontWeight:700, color:'#9a3412'}}>Unique plates</div><div style={{fontWeight:800, fontSize:16}}>{uniqueSet.size}</div><div style={{fontSize:10, color:'#64748b'}}>non-empty normalized</div></div>
                  <div><div style={{fontSize:10, fontWeight:700, color:'#9a3412'}}>Stolen vehicles</div><div style={{fontWeight:800, fontSize:16, color: stolenSet.size>0?'#dc2626':'#16a34a'}}>{stolenSet.size}</div><div style={{fontSize:10, color:'#64748b'}}>{[...stolenSet].join(', ')||'—'}</div></div>
                </div>
                {stolenSet.size>0 && <div style={{marginTop:8, background:'#dc2626', color:'#fff', padding:8, borderRadius:8, fontWeight:800}}>🚨 STOLEN: {[...stolenSet].join(', ')} — DEMO STOLEN VEHICLE REGISTRY ⚠️ NOT A LIVE POLICE DATABASE</div>}
              </>
              )
            })()}
            <div style={{maxHeight:520, overflow:'auto', marginTop:12, display:'grid', gap:10}}>
              {(anprResult.per_frame||[]).map((fr,i)=>{
                const hasPlates = fr.plates && fr.plates.length>0
                return (
                <div key={i} style={{background:'#fff', border:'1px solid #fed7aa', borderRadius:10, padding:10}}>
                  <div style={{fontWeight:800, fontSize:12, marginBottom:8}}>FRAME {fr.frame_number} @ {fr.timestamp}s {hasPlates ? <span style={{background:'#22c55e', color:'#fff', padding:'2px 8px', borderRadius:999, fontSize:10, marginLeft:8}}>🚗 PLATE DETECTED</span> : <span style={{background:'#94a3b8', color:'#fff', padding:'2px 8px', borderRadius:999, fontSize:10, marginLeft:8}}>NO PLATE DETECTED</span>}</div>
                  {!hasPlates ? (
                    <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:12, textAlign:'center', fontSize:12, color:'#64748b', fontWeight:700}}>NO PLATE DETECTED — YOLO returned zero valid plate bounding boxes</div>
                  ) : (
                    fr.plates.map((p,pi)=>{
                      const normalized = p.normalized_plate ?? p.plate_normalized ?? ''
                      const isReadable = normalized && normalized.trim() !== ''
                      const detConf = p.detector_confidence ?? p.confidence
                      const ocrConf = p.ocr_confidence
                      const theftLabel = !isReadable ? 'UNKNOWN' : (p.stolen ? '🚨 YES' : '❌ NO')
                      const bbox = p.bbox ? `[${p.bbox.join(', ')}]` : '—'
                      return (
                        <div key={pi} style={{marginTop: pi===0?0:10, border: p.stolen ? '2px solid #ef4444':'1px solid #e2e8f0', background: p.stolen ? '#fef2f2' : (!isReadable ? '#fffbeb' : '#f8fafc'), borderRadius:10, padding:12}}>
                          {p.stolen && isReadable && <div style={{background:'#dc2626', color:'#fff', padding:'4px 8px', borderRadius:6, fontWeight:800, fontSize:11, marginBottom:8, textAlign:'center'}}>🚨 STOLEN VEHICLE — Registry: DEMO STOLEN VEHICLE REGISTRY — ⚠️ NOT A LIVE POLICE DATABASE</div>}
                          {!isReadable && <div style={{background:'#f59e0b', color:'#fff', padding:'4px 8px', borderRadius:6, fontWeight:700, fontSize:11, marginBottom:8, textAlign:'center'}}>PLATE DETECTED — OCR UNREADABLE</div>}
                          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, fontSize:12}}>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>NUMBER PLATE</div><div style={{fontWeight:800, fontSize:16, color: !isReadable ? '#92400e' : p.stolen ? '#dc2626':'#0f172a'}}>{isReadable ? normalized : 'OCR UNREADABLE'}</div><div style={{fontSize:10, color:'#94a3b8'}}>raw: {p.plate_text || p.ocr_text || '—'}</div></div>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>THEFT / STOLEN VEHICLE</div><div style={{fontWeight:800, fontSize:14, color: !isReadable ? '#92400e' : p.stolen ? '#dc2626':'#16a34a'}}>{theftLabel}</div></div>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>STATUS</div><div style={{fontWeight:800}}>{p.status || (p.stolen ? 'STOLEN VEHICLE':'CLEAR')}</div><div style={{fontSize:10, color:'#64748b'}}>PRIORITY: <b style={{color: p.priority==='CRITICAL'?'#dc2626':'#16a34a'}}>{p.priority || (p.stolen?'CRITICAL':'NORMAL')}</b></div></div>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, fontSize:11, marginTop:10, background:'#fff', border:'1px solid #e2e8f0', borderRadius:8, padding:8}}>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>Detector confidence</div><div style={{fontWeight:700}}>{detConf!=null ? (detConf*100).toFixed(1)+'%':'—'}</div></div>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>OCR confidence</div><div style={{fontWeight:700}}>{ocrConf!=null ? (ocrConf*100).toFixed(1)+'%':'—'}</div></div>
                            <div><div style={{fontSize:10, fontWeight:700, color:'#64748b'}}>Bounding box</div><div style={{fontWeight:600, fontFamily:'monospace'}}>{bbox}</div></div>
                          </div>
                          {isReadable && p.stolen && <div style={{fontSize:10, color:'#9a3412', marginTop:6}}>Plate matches DEMO STOLEN VEHICLE REGISTRY (AP39AB1234, TS09CD5678, AP37XY9999, MH12AB1234, DL01AB1234)</div>}
                        </div>
                      )
                    })
                  )}
                </div>
                )
              })}
            </div>
          </div>
        )}
        <div style={{marginTop:8, fontSize:10, color:'#94a3b8'}}>Demo stolen registry isolated in <code>anpr.py STOLEN_VEHICLES</code> — replace with PostgreSQL lookup later. Try AP39AB1234 (stolen) vs any other.</div>
      </div>

      <p style={{textAlign:'center', fontSize:10, color:'#94a3b8', marginTop:12}}>Pipeline: ANPR is separate from road incidents (pothole/damaged_road/waterlogging) — not mixed.</p>
    </div>
  )
}
