import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createWork } from "../services/workService";
import api from "../services/api";

function titleFromType(t:string){
  const m:Record<string,string>={pothole:"Fix pothole",damaged_road:"Repair damaged road",waterlogging:"Resolve waterlogging",garbage:"Clear garbage",streetlight:"Fix streetlight",missing_divider:"Restore divider",missing_zebra:"Restore zebra crossing",damaged_sign:"Repair sign",traffic_congestion:"Manage traffic congestion",pedestrian_crossing:"Fix pedestrian crossing",unsafe_driving:"Address unsafe driving",hit_and_run:"Investigate hit-and-run",other:"Fix issue"};
  return m[t]||`Fix ${t.replace(/_/g," ")}`;
}
function genTitle(inc:any){
  if(!inc) return "";
  const rawTitle=(inc.title||"").trim();
  const loc=(inc.location_name||inc.address||"").trim();
  if(rawTitle){
    return loc ? `Fix ${rawTitle} at ${loc}` : `Fix ${rawTitle}`;
  }
  const t=(inc.incident_type||"").trim();
  if(t){
    const base=titleFromType(t);
    return loc ? `${base} at ${loc}` : base;
  }
  return loc ? `Fix issue at ${loc}` : "Fix issue";
}
function genDesc(inc:any){
  if(!inc) return "";
  if((inc.description||"").trim()) return inc.description.trim();
  // simple factual fallback without inventing
  const parts:string[]=[];
  if(inc.incident_type) parts.push(`Issue: ${inc.incident_type.replace(/_/g," ")}`);
  if(inc.location_name||inc.address) parts.push(`Location: ${inc.location_name||inc.address}`);
  if(inc.severity) parts.push(`Severity: ${inc.severity}`);
  return parts.join(" | ");
}

export default function AssignWorkerModal({incidentId, incident, onClose, onSuccess}:{incidentId:number; incident?:any; onClose:()=>void; onSuccess:()=>void}){
  const [assigned_to,setAssigned]=useState(""); const [due_date,setDue]=useState(""); const [description,setDesc]=useState(""); const [title,setTitle]=useState(""); const [loading,setLoading]=useState(false); const [err,setErr]=useState<string|null>(null);
  const [workers,setWorkers]=useState<any[]>([]); const [workersLoading,setWorkersLoading]=useState(true); const [workersErr,setWorkersErr]=useState<string|null>(null);
  // init title/description only when modal opens / incident changes
  useEffect(()=>{
    if(incident){
      setTitle(genTitle(incident));
      setDesc(genDesc(incident));
    }
  },[incident?.id, incident?.title, incident?.incident_type, incident?.location_name, incident?.address]);
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        setWorkersLoading(true); setWorkersErr(null);
        const r=await api.get("/users",{params:{role:"worker", limit:50}});
        if(!cancelled) setWorkers(Array.isArray(r.data)?r.data:[]);
      }catch(e:any){ if(!cancelled) setWorkersErr(e.response?.data?.detail||e.message||"Failed to load workers"); }
      finally{ if(!cancelled) setWorkersLoading(false); }
    })();
    return()=>{cancelled=true};
  },[]);
  const submit=async(e:any)=>{
    e.preventDefault(); setLoading(true); setErr(null);
    try{
      await createWork({ title, incident_id:incidentId, assigned_to:Number(assigned_to), description, due_date: due_date? new Date(due_date).toISOString(): undefined });
      onSuccess(); onClose();
    }catch(ex:any){ setErr(ex.response?.data?.detail||ex.message); } finally{ setLoading(false); }
  };
  const modal = (
<div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-[1px]" style={{zIndex:9999}}>
      <div className="min-h-full flex items-center justify-center w-full py-4">
      <form onSubmit={submit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 shadow-xl border border-surface-border my-auto">
      <h3 className="font-semibold text-lg text-ink">Assign Work</h3>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Work Title</label>
        <input required value={title} onChange={e=>setTitle(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:outline-none"/>
        <p className="text-xs text-ink-muted mt-1">Auto-filled from incident — editable</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Assign to Worker</label>
        {workersLoading ? <div className="text-xs text-ink-muted py-2">Loading workers...</div>
        : workers.length>0 ? (
          <select required value={assigned_to} onChange={e=>setAssigned(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:outline-none bg-white">
            <option value="">Select worker</option>
            {workers.map((w:any)=>(<option key={w.id} value={w.id}>{w.full_name || w.name || w.email || `Worker #${w.id}`} ({w.email})</option>))}
          </select>
        ) : (
          <>
            {workersErr && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-2">{workersErr}</p>}
            <input required placeholder="Worker User ID (assigned_to)" value={assigned_to} onChange={e=>setAssigned(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:outline-none" type="number"/>
            <p className="text-xs text-ink-muted mt-1">No workers found — enter ID manually</p>
          </>
        )}
      </div>
      <input type="datetime-local" value={due_date} onChange={e=>setDue(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:outline-none"/>
      <div>
        <label className="block text-xs font-semibold text-ink mb-1">Description</label>
        <textarea value={description} onChange={e=>setDesc(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-2.5 text-sm focus:border-brand focus:outline-none" rows={3}/>
      </div>
      {err&&<p className="text-sm text-red-600 bg-red-50 p-2 rounded">{err}</p>}
      <div className="flex gap-2 justify-end"><button type="button" onClick={onClose} className="px-4 py-2 border-2 border-surface-border rounded-xl text-sm font-medium hover:bg-surface-page">Cancel</button><button disabled={loading} className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-hover disabled:bg-brand-300">{loading?"Assigning...":"Assign"}</button></div>
      </form>
      </div>
    </div>
  );
  return typeof document!=="undefined" ? createPortal(modal, document.body) : modal;
}
