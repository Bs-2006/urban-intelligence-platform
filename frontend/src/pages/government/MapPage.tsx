import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import IncidentMap from "../../components/IncidentMap";
import LoadingSpinner from "../../components/LoadingSpinner";
import { getIncidents } from "../../services/incidentService";
import { getBusStands } from "../../services/busStandService";
export default function MapPage(){
  const [incidents,setIncidents]=useState<any[]>([]); const [stands,setStands]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const fetch=()=> Promise.all([getIncidents({limit:200}), getBusStands({limit:50}).catch(()=>[])]).then(([a,b]:any)=>{ const arr=Array.isArray(a)?a:a.items||[]; setIncidents(arr); const s=Array.isArray(b)?b:b.items||[]; setStands(s); }).finally(()=>setLoading(false));
    fetch();
    const interval= Number(import.meta.env.VITE_INCIDENT_POLL_INTERVAL || 10000);
    const t=setInterval(fetch, interval);
    const hasDistrict=false;
    if(!hasDistrict) console.info("District filtering requires backend district data – UI disabled");
    return ()=> clearInterval(t);
  },[]);
  return <><Topbar title="Live Map"/>
    <div className="p-6">{loading? <LoadingSpinner/> : <IncidentMap incidents={incidents} stands={stands}/>}<p className="text-xs text-ink-subtle mt-2">Click marker → View incident details. Bus stands shown if endpoint available.</p></div>
  </>;
}
