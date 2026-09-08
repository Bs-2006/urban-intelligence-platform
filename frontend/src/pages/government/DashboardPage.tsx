import { useEffect, useState } from "react";
import StatCard from "../../components/StatCard";
import IncidentTable from "../../components/IncidentTable";
import IncidentMap from "../../components/IncidentMap";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Topbar from "../../components/Topbar";
import { getIncidents } from "../../services/incidentService";
import { getVehicleSecurity } from "../../services/vehicleSecurityService";
import { AlertTriangle, Clock, CheckCircle, AlertOctagon, Car } from "lucide-react";
import { Incident } from "../../types/incident";
import AIAssistant from "../../components/AIAssistant";
export default function DashboardPage(){
  const [incidents,setIncidents]=useState<Incident[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const [vehicles,setVehicles]=useState<any[]>([]);
  useEffect(()=>{
    const fetch=()=> getIncidents({limit:100}).then((res:any)=>{ const arr=Array.isArray(res)?res:res.items||[]; setIncidents(arr); setError(null); }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
    const fetchVs=()=> getVehicleSecurity({limit:20}).then(setVehicles).catch(()=>{});
    fetch(); fetchVs();
    const interval= Number(import.meta.env.VITE_INCIDENT_POLL_INTERVAL || 10000);
    const t=setInterval(()=>{fetch(); fetchVs();}, interval);
    return ()=> clearInterval(t);
  },[]);
  if(loading) return <><Topbar title="Dashboard"/><LoadingSpinner/></>;
  if(error) return <><Topbar title="Dashboard"/><div className="p-6 text-red-600">{error}</div></>;
  const total=incidents.length; const pending=incidents.filter(i=>["reported","pending"].includes(i.status)).length;
  const inprog=incidents.filter(i=>i.status==="in_progress").length; const resolved=incidents.filter(i=>i.status==="resolved").length;
  const critical=incidents.filter(i=>i.severity==="critical").length; const ai=incidents.filter(i=>i.source==="ai").length; const citizen=incidents.filter(i=>i.source==="citizen").length;
  return <><Topbar title="Dashboard"/>
    <div className="p-6 space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard title="Total Incidents" value={total} icon={<AlertTriangle size={18}/>} />
        <StatCard title="Pending" value={pending} icon={<Clock size={18}/>} accent="bg-amber-50 text-amber-600"/>
        <StatCard title="In Progress" value={inprog} icon={<Clock size={18}/>} accent="bg-blue-50 text-blue-600"/>
        <StatCard title="Resolved" value={resolved} icon={<CheckCircle size={18}/>} accent="bg-green-50 text-green-600"/>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Critical" value={critical} icon={<AlertOctagon size={18}/>} accent="bg-red-50 text-red-600"/>
        <StatCard title="AI Detected" value={ai} />
        <StatCard title="Citizen Reported" value={citizen} />
      </div>
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Car size={18}/> Vehicle Security / ANPR</h2>
        <p className="text-xs text-gray-500 mb-2">DEMO STOLEN VEHICLE REGISTRY: AP39AB1234, TS09CD5678, AP37XY9999, MH12AB1234, DL01AB1234 — NOT A LIVE POLICE DATABASE</p>
        {vehicles.length===0 ? <EmptyState title="No vehicle detections" desc="ANPR processes each bus observation automatically."/> : (
          <div className="grid md:grid-cols-2 gap-3">
            {vehicles.slice(0,6).map((v:any)=>(
              <div key={v.id} className={`border rounded-lg p-3 ${v.stolen?"bg-red-50 border-red-300":"bg-gray-50"}`}>
                <div className="font-bold text-sm">{v.stolen ? "🚨 STOLEN VEHICLE" : v.status==="NO PLATE DETECTED" ? "NO PLATE DETECTED" : "🚗 VEHICLE SECURITY"}</div>
                <div className="text-xs mt-1">Bus: <b>{v.bus_id}</b> Route: <b>{v.route_id||"—"}</b> Location: {v.location_name||"—"}</div>
                <div className="text-sm mt-1">Number Plate: <b className="text-base">{v.plate_normalized || "OCR UNREADABLE"}</b> <span className="text-xs text-gray-500">raw: {v.plate_number||"—"}</span></div>
                <div className="text-xs">Plate Detection: {v.status==="NO PLATE DETECTED"?"NO":"YES"} | Detector: {v.detector_confidence ? (v.detector_confidence*100).toFixed(1)+"%":"—"} | OCR: {v.ocr_confidence ? (v.ocr_confidence*100).toFixed(1)+"%":"—"}</div>
                <div className="text-xs mt-1">THEFT / STOLEN VEHICLE: <b className={v.plate_normalized ? (v.stolen?"text-red-600":"text-green-600"):"text-amber-600"}>{!v.plate_normalized ? "UNKNOWN" : v.stolen ? "YES" : "NO"}</b> | Status: <b>{v.status}</b> | Priority: <b className={v.priority==="CRITICAL"?"text-red-600":""}>{v.priority}</b></div>
                {v.stolen && <div className="text-xs mt-1 bg-red-600 text-white px-2 py-1 rounded">Registry: DEMO STOLEN VEHICLE REGISTRY — NOT A LIVE POLICE DATABASE</div>}
                <div className="text-xs text-gray-500 mt-1">Observed: {v.created_at ? new Date(v.created_at).toLocaleString() : ""} {v.bbox ? `BBox: [${v.bbox.join(", ")}]` : ""}</div>
                {v.image_url && <img src={v.image_url.startsWith("http")?v.image_url:`http://localhost:8000${v.image_url}`} alt="bus" className="mt-2 rounded w-full max-h-32 object-cover" onError={(e:any)=>{e.target.style.display="none"}}/>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Recent Incidents</h2>
        {incidents.length===0? <EmptyState title="No incidents" desc="Incidents will appear here once bus cameras or citizens report."/> : <IncidentTable incidents={incidents.slice(0,5)}/>}
      </div>
      <div><AIAssistant /></div>
      <div><h2 className="font-semibold mb-2">Live Incident Map</h2>{incidents.length===0? <EmptyState title="No map data"/> : <IncidentMap incidents={incidents.slice(0,50)}/>}</div>
    </div>
  </>;
}
