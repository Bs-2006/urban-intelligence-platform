import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Topbar from "../../components/Topbar";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import { getWorks } from "../../services/workService";
import { getIncident } from "../../services/incidentService";
import { updateWork } from "../../services/workService";
import { fmtDate } from "../../utils/formatters";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
export default function WorkDetailsPage(){
  const {id}=useParams(); const [work,setWork]=useState<any>(null); const [incident,setIncident]=useState<any>(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState<string|null>(null); const [msg,setMsg]=useState("");
  const load=async()=>{
    if(!id) {setErr("Missing work id"); setLoading(false); return;}
    setLoading(true); setErr(null);
    try{
      // Reuse existing GET /work/ (backend has no GET /work/{id}) — filter client-side
      const all:any = await getWorks({limit:200});
      const arr = Array.isArray(all)?all:(all.items||[]);
      const w = arr.find((x:any)=> String(x.id)===String(id));
      if(!w){ setErr("Work order not found"); setWork(null); return; }
      setWork(w);
      if(w.incident_id){
        try{ const inc=await getIncident(w.incident_id); setIncident(inc); }catch{ setIncident(null); }
      }
    }catch(e:any){
      setErr(e.response?.data?.detail || e.message || "Failed to load work order");
    }finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[id]);
  const patch=async(status:string)=>{ try{ await updateWork(id!,{status}); setMsg("Updated to "+status); load(); }catch(e:any){ setMsg(e.response?.data?.detail||e.message); } };
  if(loading) return <><Topbar title="Work"/><LoadingSpinner/></>;
  if(err) return <><Topbar title="Work"/><div className="p-6 max-w-2xl mx-auto text-center"><div className="bg-white border-2 border-amber-200 rounded-xl p-6"><p className="font-semibold text-slate-900">{err}</p><p className="text-sm text-slate-500 mt-1">Work ID: {id}</p><div className="flex gap-2 justify-center mt-4"><button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium">Retry</button><Link to="/work-orders" className="px-4 py-2 border-2 border-slate-300 rounded-full text-sm font-medium">Back to Work Orders</Link></div></div></div></>;
  if(!work) return <><Topbar title="Work"/><div className="p-6">Not found</div></>;
  return <><Topbar title={`Work #${work.id}`}/>
    <div className="p-6 grid lg:grid-cols-2 gap-6">
      <div className="bg-white border rounded-xl p-6 space-y-3">
        <div className="flex justify-between items-start gap-2"><h2 className="font-bold text-slate-900">{work.title}</h2><StatusBadge status={work.status}/></div>
        <p className="text-sm text-gray-600">{work.description||"-"}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">ID</span><p className="font-medium">#{work.id}</p></div>
          <div><span className="text-gray-500">Incident</span><p className="font-medium">#{work.incident_id ?? "-"}</p></div>
          <div><span className="text-gray-500">Assigned To</span><p className="font-medium">{work.assigned_to ?? "-"}</p></div>
          <div><span className="text-gray-500">Status</span><p className="font-medium capitalize">{work.status}</p></div>
          <div><span className="text-gray-500">Created</span><p>{fmtDate(work.created_at)}</p></div>
          <div><span className="text-gray-500">Due</span><p>{fmtDate(work.due_date)}</p></div>
        </div>
        <p className="text-sm">Incident #{work.incident_id} {incident && `- ${incident.title}`}</p>
        {incident && <><p className="text-sm">Location: {incident.location_name} {incident.address}</p>{incident.image_url&&<img src={incident.image_url} alt="evidence" className="rounded max-h-64 w-full object-cover border" onError={(e:any)=>e.currentTarget.style.display="none"}/>}<div className="h-48 rounded overflow-hidden border"><MapContainer center={[incident.latitude,incident.longitude]} zoom={14} className="h-full w-full"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={[incident.latitude,incident.longitude]}/></MapContainer></div></>}
        <div className="flex gap-2 flex-wrap">{work.status==="assigned"&&<button onClick={()=>patch("in_progress")} className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium">Start Work</button>}{work.status==="in_progress"&&<button onClick={()=>patch("completed")} className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">Complete Work</button>}<Link to="/work-orders" className="px-4 py-2 border-2 border-slate-300 rounded-full text-sm font-medium">Back to list</Link></div>
        {msg&&<p className="text-sm text-blue-600">{msg}</p>}
      </div>
      <div className="bg-white border rounded-xl p-6"><h3 className="font-semibold">Incident Details</h3>{incident? <div className="text-sm mt-2 space-y-1"><p>{incident.incident_type} | {incident.severity}</p><p>{incident.description||"-"}</p><p className="text-xs text-slate-500">Location: {incident.location_name||incident.address||`${incident.latitude}, ${incident.longitude}`}</p>{incident.image_url&&<img src={incident.image_url} alt="evidence" className="rounded max-h-48 w-full object-cover border mt-2" onError={(e:any)=>e.currentTarget.style.display="none"}/>}</div> : <p className="text-sm text-gray-400">No incident data</p>}</div>
    </div>
  </>;
}
