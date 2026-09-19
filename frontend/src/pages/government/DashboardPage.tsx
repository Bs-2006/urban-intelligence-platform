import { useEffect, useState } from "react";
import StatCard from "../../components/StatCard";
import IncidentTable from "../../components/IncidentTable";
import IncidentMap from "../../components/IncidentMap";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import Topbar from "../../components/Topbar";
import { getIncidents } from "../../services/incidentService";
import { AlertTriangle, Clock, CheckCircle, AlertOctagon } from "lucide-react";
import { Incident } from "../../types/incident";

export default function DashboardPage(){
  const [incidents,setIncidents]=useState<Incident[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{
    const fetch=()=>
      getIncidents({limit:100})
        .then((res:any)=>{ const arr=Array.isArray(res)?res:res.items||[]; setIncidents(arr); setError(null); })
        .catch(e=>setError(e.message))
        .finally(()=>setLoading(false));

    fetch();
    const interval=Number(import.meta.env.VITE_INCIDENT_POLL_INTERVAL||10000);
    const t=setInterval(fetch, interval);
    return ()=>clearInterval(t);
  },[]);

  if(loading) return <><Topbar title="Dashboard"/><LoadingSpinner/></>;
  if(error)   return <><Topbar title="Dashboard"/><div className="p-6 text-red-600">{error}</div></>;

  const total    = incidents.length;
  const pending  = incidents.filter(i=>["reported","pending"].includes(i.status)).length;
  const inprog   = incidents.filter(i=>i.status==="in_progress").length;
  const resolved = incidents.filter(i=>i.status==="resolved").length;
  const critical = incidents.filter(i=>i.severity==="critical").length;
  const ai       = incidents.filter(i=>i.source==="ai").length;
  const citizen  = incidents.filter(i=>i.source==="citizen").length;

  return (
    <>
      <Topbar title="Dashboard"/>
      <div className="p-6 space-y-6">

        {/* ── Row 1: 4 equal-width, equal-height cards ── */}
        {/* items-stretch makes every cell the same height as the tallest card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
          <StatCard title="Total Incidents" value={total}    icon={<AlertTriangle size={18}/>} />
          <StatCard title="Pending"         value={pending}  icon={<Clock size={18}/>} accent="bg-amber-50 text-amber-600"/>
          <StatCard title="In Progress"     value={inprog}   icon={<Clock size={18}/>} accent="bg-brand-50 text-brand"/>
          <StatCard title="Resolved"        value={resolved} icon={<CheckCircle size={18}/>} accent="bg-green-50 text-green-600"/>
        </div>

        {/* ── Row 2: 3 equal-width, equal-height cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
          <StatCard title="Critical"         value={critical} icon={<AlertOctagon size={18}/>} accent="bg-red-50 text-red-600"/>
          <StatCard title="AI Detected"      value={ai} />
          <StatCard title="Citizen Reported" value={citizen} />
        </div>

        {/* ── Recent Incidents ── */}
        <div>
          <h2 className="font-semibold mb-2 text-ink">Recent Incidents</h2>
          {incidents.length===0
            ? <EmptyState title="No incidents" desc="Incidents will appear here once bus cameras or citizens report."/>
            : <IncidentTable incidents={incidents.slice(0,5)}/>}
        </div>

        {/* ── Live Incident Map ── */}
        <div>
          <h2 className="font-semibold mb-2 text-ink">Live Incident Map</h2>
          {incidents.length===0
            ? <EmptyState title="No map data"/>
            : <IncidentMap incidents={incidents.slice(0,50)}/>}
        </div>

      </div>
    </>
  );
}
