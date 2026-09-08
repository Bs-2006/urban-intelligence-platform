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
        <div className="bg-white border rounded-xl p-6">
          <div className="flex gap-2 items-center"><h2 className="font-bold text-lg">{data.title}</h2><StatusBadge status={data.status}/><SeverityBadge severity={data.severity}/></div>
          <p className="text-sm text-gray-600 mt-2">{data.description}</p>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div><span className="text-gray-500">Issue Type</span><p className="font-medium">{data.incident_type}</p></div>
            <div><span className="text-gray-500">Source</span><p>{data.source==="ai"?"AI Detected":"Citizen Report"}</p></div>
            <div><span className="text-gray-500">Location</span><p>{data.location_name||data.address}</p></div>
            <div><span className="text-gray-500">Lat/Lng</span><p>{data.latitude}, {data.longitude}</p></div>
            <div><span className="text-gray-500">Bus / Route</span><p>{data.bus_id||"-"} / {data.route_id||"-"}</p></div>
            <div><span className="text-gray-500">AI Confidence</span><p>{data.ai_confidence??"-"}</p></div>
            <div><span className="text-gray-500">Created</span><p>{fmtDate(data.created_at)}</p></div>
            <div><span className="text-gray-500">Occurred</span><p>{fmtDate(data.occurred_at)}</p></div>
          </div>
          {data.image_url ? <img src={data.image_url} alt="evidence" className="mt-4 rounded max-h-80 w-full object-cover border" onError={(e:any)=>{e.currentTarget.style.display="none"; const sib=e.currentTarget.nextElementSibling; if(sib) (sib as HTMLElement).style.display="block";}} /> : null}
          {data.image_url ? <div style={{display:"none"}} className="mt-4 border-2 border-amber-200 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">Evidence image failed to load - URL may not be publicly accessible. Key: {data.image_key||"-"}</div> : <div className="mt-4 border-dashed border-2 border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">No evidence image</div>}
          <div className="mt-3"><label className="text-sm">Upload evidence<input type="file" accept="image/*" onChange={onFile} className="ml-2 text-sm"/></label></div>
        </div>
        <div className="h-64 rounded-xl overflow-hidden border">
          <MapContainer center={[data.latitude,data.longitude]} zoom={14} className="h-full w-full" scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[data.latitude,data.longitude]}/></MapContainer>
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold">Manager Actions</h3>
          {existing && !cancelled ? (
            <div className="mt-3 border-2 border-green-200 bg-green-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"/><span className="text-sm font-extrabold text-green-800 tracking-wide">WORK ASSIGNED</span></div>
              <div className="text-sm"><span className="text-slate-500">Assigned To:</span><p className="font-semibold text-slate-900">{workersMap[String(existing.assigned_to)] || `Worker #${existing.assigned_to}`}</p></div>
              <div className="text-sm"><span className="text-slate-500">Work Order:</span><p className="font-semibold text-slate-900">#{existing.id}</p></div>
              <div className="text-sm"><span className="text-slate-500">Work Status:</span><p className="font-semibold capitalize"><StatusBadge status={existing.status}/></p></div>
              {completed && <p className="text-xs text-green-700 font-medium">Completed — no further action needed</p>}
              {active && <p className="text-xs text-slate-600">Work is active — duplicate assignment disabled</p>}
              <Link to={`/work-orders/${existing.id}`} className="inline-flex mt-2 px-4 py-2 bg-white border-2 border-slate-300 rounded-full text-sm font-semibold hover:bg-slate-50">View Work Order</Link>
              {cancelled && <p className="text-xs text-amber-700 mt-2">Previous work was cancelled — you may reassign</p>}
            </div>
          ) : null}
          {cancelled && <div className="mt-3"><button onClick={()=>setShowAssign(true)} className="w-full bg-blue-600 text-white py-2.5 rounded-full font-semibold text-sm hover:bg-blue-700">Reassign Work</button></div>}
          {showAssignBtn && !existing && <button onClick={()=>setShowAssign(true)} className="w-full mt-3 bg-blue-600 text-white py-2.5 rounded-full font-semibold text-sm hover:bg-blue-700">Assign Work</button>}
          {existing && !cancelled && !completed && active && <div className="mt-3 text-xs text-slate-500 text-center">Duplicate assignment prevented — work already exists</div>}
          <div className="mt-4 space-y-2">
            <label className="text-sm">Status<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})} className="w-full border rounded px-2 py-1 mt-1">{["reported","pending","in_progress","resolved","rejected","closed"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
            <label className="text-sm">Severity<select value={edit.severity} onChange={e=>setEdit({...edit,severity:e.target.value})} className="w-full border rounded px-2 py-1 mt-1">{["low","medium","high","critical"].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
            <label className="text-sm">Description<textarea value={edit.description||""} onChange={e=>setEdit({...edit,description:e.target.value})} className="w-full border rounded px-2 py-1 mt-1"/></label>
            <button onClick={save} className="w-full border py-2 rounded-lg">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
    {showAssign&&<AssignWorkerModal incidentId={Number(id)} incident={data} onClose={()=>setShowAssign(false)} onSuccess={()=>loadWorks()}/>}
  </>;
}

