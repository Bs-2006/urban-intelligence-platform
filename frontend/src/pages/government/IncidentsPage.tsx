import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import IncidentTable from "../../components/IncidentTable";
import IncidentFilters from "../../components/IncidentFilters";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getIncidents } from "../../services/incidentService";
import { Incident } from "../../types/incident";
export default function IncidentsPage(){
  const [filters,setFilters]=useState<any>({}); const [search,setSearch]=useState("");
  const [data,setData]=useState<Incident[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const fetch=()=>{
    setLoading(true); getIncidents({...filters, limit:100}).then((res:any)=>{ const arr=Array.isArray(res)?res:res.items||[]; setData(arr); }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  };
  useEffect(()=>{ fetch(); },[JSON.stringify(filters)]);
  const filtered=data.filter(i=> !search || i.title.toLowerCase().includes(search.toLowerCase()) || (i.location_name||"").toLowerCase().includes(search.toLowerCase()) || (i.address||"").toLowerCase().includes(search.toLowerCase()));
  return <><Topbar title="Incidents"/>
    <div className="p-6 space-y-4">
      <IncidentFilters filters={filters} setFilters={setFilters}/>
      <input placeholder="Search title / location / address (local)" value={search} onChange={e=>setSearch(e.target.value)} className="w-full border rounded-lg px-3 py-2"/>
      {loading? <LoadingSpinner/> : error? <div className="text-red-600">{error}</div> : filtered.length===0? <EmptyState title="No incidents found"/> : <IncidentTable incidents={filtered}/>}
    </div>
  </>;
}
