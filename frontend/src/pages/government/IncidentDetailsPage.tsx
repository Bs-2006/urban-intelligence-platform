import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Topbar from "../../components/Topbar";
import StatusBadge from "../../components/StatusBadge";
import SeverityBadge from "../../components/SeverityBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import AssignWorkerModal from "../../components/AssignWorkerModal";
import { getIncident, updateIncident, uploadIncidentImage } from "../../services/incidentService";
import { getWorks } from "../../services/workService";
import api from "../../services/api";
import { fmtDate } from "../../utils/formatters";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
export default function IncidentDetailsPage(){
  const {id}=useParams(); const [data,setData]=useState<any>(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState<string|null>(null);
  const [showAssign,setShowAssign]=useState(false);
  const [edit,setEdit]=useState<any>({});
  const [workOrders,setWorkOrders]=useState<any[]>([]); const [workersMap,setWorkersMap]=useState<Record<string,string>>({});
  const load=()=>{ if(!id) return; getIncident(id).then(d=>{ setData(d); setEdit({status:d.status, severity:d.severity, description:d.description}); }).catch(e=>setErr(e.message)).finally(()=>setLoading(false)); };
  const loadWorks=async()=>{
    if(!id) return;
    try{
      const r:any = await getWorks({limit:200});
      const arr = Array.isArray(r)?r:(r.items||[]);
      const filtered = arr.filter((w:any)=> String(w.incident_id)===String(id));
      setWorkOrders(filtered);
    }catch{}
  };
  const loadWorkersMap=async()=>{
    try{
      const r=await api.get("/users",{params:{role:"worker",limit:50}});
      const m:Record<string,string>={};
      (Array.isArray(r.data)?r.data:[]).forEach((u:any)=>{ m[String(u.id)] = u.full_name || u.name || u.email || `Worker #${u.id}`; });
      setWorkersMap(m);
    }catch{}
  };
  useEffect(()=>{ load(); loadWorks(); loadWorkersMap(); },[id]);
  const save=async()=>{ try{ await updateIncident(id!,edit); alert("Updated"); load(); }catch(e:any){ alert(e.message); } };
  const onFile=async(e:any)=>{ const f=e.target.files?.[0]; if(!f) return; try{ await uploadIncidentImage(id!,f); alert("Image uploaded"); load(); }catch(ex:any){ alert(ex.message); } };
  if(loading) return <><Topbar title="Incident"/><LoadingSpinner/></>;
  if(err) return <><Topbar title="Incident"/><div className="p-6 text-red-600">{err}</div></>;
  if(!data) return <><Topbar title="Incident"/><div className="p-6">Not found</div></>;
  const existing = workOrders.length ? workOrders[workOrders.length-1] : null;
  const active = existing && ["assigned","in_progress"].includes(existing.status);
  const completed = existing && existing.status==="completed";
  const cancelled = existing && existing.status==="cancelled";
  const showAssignBtn = !existing || cancelled;
  return <><Topbar title={`Incident #${data.id}`}/>
    <div className="p-6 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
<div className="bg-white border border-surface-border rounded-xl p-6 shadow-sm">
          <div className="flex gap-2 items-center"><h2 className="font-bold text-lg text-ink">{data.title}</h2><StatusBadge status={data.status}/><SeverityBadge severity={data.severity}/></div>
          <p className="text-sm text-ink-muted mt-2">{data.description}</p>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div><span className="text-ink-muted">Issue Type</span><p className="font-medium text-ink">{data.incident_type}</p></div>
            <div><span className="text-ink-muted">Source</span><p className="text-ink">{data.source==="ai"?"AI Detected":"Citizen Report"}</p></div>
            <div><span className="text-ink-muted">Location</span><p className="text-ink">{data.location_name||data.address}</p></div>
            <div><span className="text-ink-muted">Lat/Lng</span><p className="text-ink">{data.latitude}, {data.longitude}</p></div>
            <div><span className="text-ink-muted">Bus / Route</span><p className="text-ink">{data.bus_id||"-"} / {data.route_id||"-"}</p></div>
            <div><span className="text-ink-muted">AI Confidence</span><p className="text-ink">{data.ai_confidence??"-"}</p></div>
            <div><span className="text-ink-muted">Created</span><p className="text-ink">{fmtDate(data.created_at)}</p></div>
            <div><span className="text-ink-muted">Occurred</span><p className="text-ink">{fmtDate(data.occurred_at)}</p></div>
          </div>
          {data.image_url ? <img src={data.image_url} alt="evidence" className="mt-4 rounded max-h-80 w-full object-cover border border-surface-border" onError={(e:any)=>{e.currentTarget.style.display="none"; const sib=e.currentTarget.nextElementSibling; if(sib) (sib as HTMLElement).style.display="block";}} /> : null}
          {data.image_url ? <div style={{display:"none"}} className="mt-4 border-2 border-amber-200 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">Evidence image failed to load - URL may not be publicly accessible. Key: {data.image_key||"-"}</div> : <div className="mt-4 border-dashed border-2 border-surface-border rounded-xl p-4 text-center text-sm text-ink-muted">No evidence image</div>}
          <div className="mt-3"><label className="text-sm text-ink">Upload evidence<input type="file" accept="image/*" onChange={onFile} className="ml-2 text-sm"/></label></div>
        </div>
        <div className="h-64 rounded-xl overflow-hidden border border-surface-border">
          <MapContainer center={[data.latitude,data.longitude]} zoom={14} className="h-full w-full" scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[data.latitude,data.longitude]}/></MapContainer>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white border border-surface-border rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-ink">Manager Actions</h3>
          {existing && !cancelled ? (
            <div className="mt-3 border-2 border-brand-200 bg-brand-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-brand rounded-full animate-pulse"/><span className="text-sm font-extrabold text-brand-800 tracking-wide">WORK ASSIGNED</span></div>
              <div className="text-sm"><span className="text-ink-muted">Assigned To:</span><p className="font-semibold text-ink">{workersMap[String(existing.assigned_to)] || `Worker #${existing.assigned_to}`}</p></div>
              <div className="text-sm"><span className="text-ink-muted">Work Order:</span><p className="font-semibold text-ink">#{existing.id}</p></div>
              <div className="text-sm"><span className="text-ink-muted">Work Status:</span><p className="font-semibold capitalize"><StatusBadge status={existing.status}/></p></div>
              {completed && <p className="text-xs text-brand-700 font-medium">Completed — no further action needed</p>}
              {active && <p className="text-xs text-ink-muted">Work is active — duplicate assignment disabled</p>}
              <Link to={`/work-orders/${existing.id}`} className="inline-flex mt-2 px-4 py-2 bg-white border-2 border-surface-border rounded-xl text-sm font-semibold text-ink hover:bg-surface-subtle">View Work Order</Link>
              {cancelled && <p className="text-xs text-amber-700 mt-2">Previous work was cancelled — you may reassign</p>}
            </div>
          ) : null}
          {cancelled && <div className="mt-3"><button onClick={()=>setShowAssign(true)} className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-hover">Reassign Work</button></div>}
          {showAssignBtn && !existing && <button onClick={()=>setShowAssign(true)} className="w-full mt-3 bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-hover">Assign Work</button>}
          {existing && !cancelled && !completed && active && <div className="mt-3 text-xs text-ink-muted text-center">Duplicate assignment prevented — work already exists</div>}
          <div className="mt-4 space-y-2">
            <label className="text-sm text-ink">Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})} className="w-full border border-surface-border bg-white rounded-lg px-2 py-1.5 mt-1 text-ink">{["reported","pending","in_progress","resolved","rejected","closed"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
            <label className="text-sm text-ink">Severity<select value={edit.severity} onChange={e=>setEdit({...edit,severity:e.target.value})} className="w-full border border-surface-border bg-white rounded-lg px-2 py-1.5 mt-1 text-ink">{["low","medium","high","critical"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
            <label className="text-sm text-ink">Description<textarea value={edit.description||""} onChange={e=>setEdit({...edit,description:e.target.value})} className="w-full border border-surface-border bg-white rounded-lg px-2 py-1.5 mt-1 text-ink"/></label>
            <button onClick={save} className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-hover">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
    {showAssign&&<AssignWorkerModal incidentId={Number(id)} incident={data} onClose={()=>setShowAssign(false)} onSuccess={()=>loadWorks()}/>}
  </>;
}

