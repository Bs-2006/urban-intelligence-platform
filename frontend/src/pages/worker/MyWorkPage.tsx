import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import WorkerTaskCard from "../../components/WorkerTaskCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { getWorks, updateWork } from "../../services/workService";
import { getIncident } from "../../services/incidentService";

export default function MyWorkPage(){
  const { user } = useAuth();
  const myId = user?.id;
  const [orders,setOrders]=useState<any[]>([]);
  const [incMap,setIncMap]=useState<Record<number,any>>({});
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);
  const [busyId,setBusyId]=useState<number|null>(null);

  const load=async()=>{
    setLoading(true); setErr(null);
    try{
      const r:any = await getWorks({limit:100});
      const arr:any[] = Array.isArray(r)?r:(r.items||[]);
      const mine = arr
        .filter(w=> myId!==undefined && String(w.assigned_to)===String(myId))
        .sort((a:any,b:any)=> String(b.created_at||"").localeCompare(String(a.created_at||"")));
      setOrders(mine);
      const ids = Array.from(new Set(mine.map((w:any)=>w.incident_id).filter(Boolean))) as number[];
      const fresh: Record<number,any> = {};
      await Promise.all(ids.map(async (i:number)=>{
        if (incMap[Number(i)]) { fresh[Number(i)] = incMap[Number(i)]; return; }
        try{ fresh[Number(i)] = await getIncident(i); }catch{ }
      }));
      setIncMap(prev=>({...prev,...fresh}));
    }catch(e:any){ setErr(e?.response?.data?.detail || e?.message || "Failed to load your tasks"); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[myId]);

  const changeStatus=async(id:number, status:string)=>{
    setBusyId(id); setErr(null);
    try{ await updateWork(id,{status}); await load(); }
    catch(e:any){ setErr(e?.response?.data?.detail || e?.message || "Update failed"); }
    finally{ setBusyId(null); }
  };

  return <><Topbar title="My Work"/>
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {loading? <LoadingSpinner/>
        : err? <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm">{err}</div>
        : orders.length===0? <EmptyState title="No tasks assigned yet" desc="New work will appear here as soon as it is assigned to you."/>
        : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{orders.map(o=><WorkerTaskCard key={o.id} task={o} incident={incMap[o.incident_id]} onStatusChange={changeStatus} busy={busyId===o.id}/>)}</div>}
    </div>
  </>;
}