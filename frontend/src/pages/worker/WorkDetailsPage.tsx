import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import Topbar from "../../components/Topbar";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../hooks/useAuth";
import { getWork, updateWork, getWorkEvidence, uploadWorkEvidence } from "../../services/workService";
import { getIncident } from "../../services/incidentService";
import { fmtDate } from "../../utils/formatters";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
export default function WorkDetailsPage(){
  const {id}=useParams(); const [work,setWork]=useState<any>(null); const [incident,setIncident]=useState<any>(null); const [evidence,setEvidence]=useState<any[]>([]); const [uploading,setUploading]=useState(false); const [loading,setLoading]=useState(true); const [err,setErr]=useState<string|null>(null); const [msg,setMsg]=useState("");
  const { user }=useAuth();
  const location=useLocation();
  const isWorkerView = location.pathname.startsWith("/worker/");
  const backLink = isWorkerView ? "/worker/work" : "/work-orders";
  const fetchEvidence=async(oid:string)=>{ try{ const rows:any[]=await getWorkEvidence(oid); setEvidence(Array.isArray(rows)?rows:[]); }catch{ setEvidence([]); } };
  const load=async()=>{
    if(!id) {setErr("Missing work id"); setLoading(false); return;}
    setLoading(true); setErr(null);
    try{
      // GET /work/{id}: workers can only fetch their own work orders (backend-enforced)
      const w:any = await getWork(id);
      // Defense-in-depth: worker view must only show the logged-in worker's own task.
      if(isWorkerView && user?.role==="worker" && String(w.assigned_to)!==String(user?.id)){ setErr("Work order not found"); setWork(null); return; }
      setWork(w);
      await fetchEvidence(String(w.id));
      if(w.incident_id){
        try{ const inc=await getIncident(w.incident_id); setIncident(inc); }catch{ setIncident(null); }
      }
    }catch(e:any){
      setErr(e.response?.data?.detail || e.message || "Failed to load work order");
    }finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[id]);
  const completedWithoutEvidence = work?.status==="completed" && evidence.length===0;
  const needsAfterForComplete = isWorkerView && work?.status==="in_progress" && evidence.length===0;
  const canUploadEvidence = work && evidence.length===0 && (user?.role==="admin" || (user?.role==="worker" && String(work.assigned_to)===String(user?.id)));
  const patch=async(status:string)=>{
    if(status==="completed" && needsAfterForComplete){ setMsg("Please upload an after-work image before marking this work as completed."); return; }
    try{ await updateWork(id!,{status}); setMsg("Updated to "+status); load(); }catch(e:any){ setMsg(e.response?.data?.detail||e.message); }
  };
  const onUpload=async(e:any)=>{
    const f:File|undefined=e.target.files?.[0]; if(!f||!id) return;
    setUploading(true); setMsg("");
    try{ await uploadWorkEvidence(id, f); e.target.value=""; await fetchEvidence(String(id)); setMsg("After-work image uploaded successfully"); }
    catch(err2:any){ setMsg(err2.response?.data?.detail||err2.message||"Upload failed"); }
    finally{ setUploading(false); }
  };
  if(loading) return <><Topbar title="Work"/><LoadingSpinner/></>;
  if(err) return <><Topbar title="Work"/><div className="p-6 max-w-2xl mx-auto text-center"><div className="bg-white border border-surface-border rounded-xl p-6 shadow-sm"><p className="font-semibold text-ink">{err}</p><p className="text-sm text-ink-muted mt-1">Work ID: {id}</p><div className="flex gap-2 justify-center mt-4"><button onClick={load} className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-hover">Retry</button><Link to={backLink} className="px-4 py-2 border-2 border-surface-border rounded-xl text-sm font-medium text-ink">Back to Work Orders</Link></div></div></div></>;
  if(!work) return <><Topbar title="Work"/><div className="p-6">Not found</div></>;
  return <><Topbar title={`Work #${work.id}`}/>
    <div className="p-6 grid lg:grid-cols-2 gap-6">
      <div className="bg-white border border-surface-border rounded-xl p-6 space-y-3 shadow-sm">
        <div className="flex justify-between items-start gap-2"><h2 className="font-bold text-ink">{work.title}</h2><StatusBadge status={work.status}/></div>
        <p className="text-sm text-ink-muted">{work.description||"-"}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-ink-muted">ID</span><p className="font-medium text-ink">#{work.id}</p></div>
          <div><span className="text-ink-muted">Incident</span><p className="font-medium text-ink">#{work.incident_id ?? "-"}</p></div>
          <div><span className="text-ink-muted">Assigned To</span><p className="font-medium text-ink">{work.assigned_to ?? "-"}</p></div>
          <div><span className="text-ink-muted">Status</span><p className="font-medium text-ink capitalize">{work.status}</p></div>
          <div><span className="text-ink-muted">Created</span><p className="text-ink">{fmtDate(work.created_at)}</p></div>
          <div><span className="text-ink-muted">Due</span><p className="text-ink">{fmtDate(work.due_date)}</p></div>
        </div>
        <p className="text-sm text-ink">Incident #{work.incident_id} {incident && `- ${incident.title}`}</p>
        {incident && <><p className="text-sm text-ink">Location: {incident.location_name} {incident.address}</p>{incident.image_url&&<img src={incident.image_url} alt="evidence" className="rounded max-h-64 w-full object-cover border border-surface-border" onError={(e:any)=>e.currentTarget.style.display="none"}/>}<div className="h-48 rounded overflow-hidden border border-surface-border"><MapContainer center={[incident.latitude,incident.longitude]} zoom={14} className="h-full w-full"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[incident.latitude,incident.longitude]}/></MapContainer></div></>}
        <div className="flex gap-2 flex-wrap">{work.status==="assigned"&&<button onClick={()=>patch("in_progress")} className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-hover">Start Work</button>}{work.status==="in_progress"&&<button onClick={()=>patch("completed")} className="bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand">Complete Work</button>}<Link to={backLink} className="px-4 py-2 border-2 border-surface-border rounded-xl text-sm font-medium text-ink">Back to list</Link></div>
        {completedWithoutEvidence && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2"><p className="text-sm font-medium text-amber-800">Completed without verification evidence</p><p className="text-xs text-amber-600 mt-1">This work was completed before the evidence feature was introduced. Upload an after-image to provide verification proof.</p></div>}
        {msg&&<p className="text-sm text-brand">{msg}</p>}
      </div>
<div className="bg-white border border-surface-border rounded-xl p-6 shadow-sm"><h3 className="font-semibold text-ink">Incident Details</h3>{incident? <div className="text-sm mt-2 space-y-1 text-ink"><p>{incident.incident_type} | {incident.severity}</p><p>{incident.description||"-"}</p><p className="text-xs text-ink-muted">Location: {incident.location_name||incident.address||`${incident.latitude}, ${incident.longitude}`}</p>{incident.image_url&&<img src={incident.image_url} alt="evidence" className="rounded max-h-48 w-full object-cover border border-surface-border mt-2" onError={(e:any)=>e.currentTarget.style.display="none"}/>}</div> : <p className="text-sm text-ink-subtle">No incident data</p>}</div>
    </div>
    <div className="px-6 pb-6">
      <div className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-ink mb-4">Work Verification</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-surface-border p-4 bg-surface-subtle">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-2">Before Image</p>
            <p className="text-sm text-ink-muted">Incident Evidence</p>
            {incident?.image_url ? <img src={incident.image_url} alt="Incident evidence" className="rounded max-h-64 w-full object-cover border border-surface-border mt-3" onError={(e:any)=>e.currentTarget.style.display="none"}/> : <p className="text-sm text-ink-subtle mt-3">No before image available</p>}
          </div>
          <div className="rounded-lg border border-surface-border p-4 bg-surface-subtle">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle mb-2">After Image</p>
            {evidence.length>0 && evidence[0]?.image_url ? (<><p className="text-sm text-ink-muted">Worker Completion Proof</p><img src={evidence[0].image_url} alt="Work completion proof" className="rounded max-h-64 w-full object-cover border border-surface-border mt-3" onError={(e:any)=>e.currentTarget.style.display="none"}/>{evidence[0].created_at&&<p className="text-xs text-ink-subtle mt-2">Uploaded {fmtDate(evidence[0].created_at)}</p>}</>) : (canUploadEvidence ? (<><p className="text-sm text-ink-subtle mt-1">{work.status==="completed" ? "Upload a photo to provide verification proof for this completed work." : "Upload a photo after completing the work as proof."}</p><label className="mt-3 inline-flex items-center gap-2 cursor-pointer"><input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading}/><span className="bg-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-hover">{uploading?"Uploading...":"Upload After Image"}</span></label></>) : <p className="text-sm text-ink-subtle mt-3">No after image available</p>)}
          </div>
        </div>
      </div>
    </div>
  </>;
}