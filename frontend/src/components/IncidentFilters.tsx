export default function IncidentFilters({filters,setFilters}:{filters:any,setFilters:any}){
  const upd=(k:string,v:string)=> setFilters((p:any)=>({...p,[k]:v||undefined}));
  return <div className="flex flex-wrap gap-2 bg-white p-3 rounded-xl border">
    <select value={filters.incident_type||""} onChange={e=>upd("incident_type",e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="">All Types</option>{["pothole","waterlogging","damaged_road","missing_divider","missing_zebra","damaged_sign","traffic_congestion","pedestrian_crossing","unsafe_driving","hit_and_run","garbage","streetlight","other"].map(t=><option key={t} value={t}>{t}</option>)}</select>
    <select value={filters.status||""} onChange={e=>upd("status",e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="">All Status</option>{["reported","pending","in_progress","resolved","rejected","closed"].map(s=><option key={s} value={s}>{s}</option>)}</select>
    <select value={filters.severity||""} onChange={e=>upd("severity",e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="">All Severity</option>{["low","medium","high","critical"].map(s=><option key={s} value={s}>{s}</option>)}</select>
    <select value={filters.source||""} onChange={e=>upd("source",e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="">All Source</option><option value="ai">AI</option><option value="citizen">Citizen</option></select>
    <input placeholder="Bus ID" value={filters.bus_id||""} onChange={e=>upd("bus_id",e.target.value)} className="border rounded px-2 py-1 text-sm w-24"/>
    <div className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border">District filter: backend district field not yet available</div>
  </div>;
}
