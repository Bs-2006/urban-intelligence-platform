import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import WorkerTaskCard from "../../components/WorkerTaskCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { useAuth } from "../../hooks/useAuth";
import { getWorks, updateWork } from "../../services/workService";
import { getIncident } from "../../services/incidentService";
import { ClipboardList, Timer, CheckCircle2, AlertOctagon, HardHat } from "lucide-react";

export default function WorkerDashboardPage(){
  const { user } = useAuth();
  const myId = user?.id;
  const [tasks,setTasks]=useState<any[]>([]);
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
      setTasks(mine);
      const ids = Array.from(new Set(mine.map((w:any)=>w.incident_id).filter(Boolean))) as number[];
      const fresh: Record<number,any> = {};
      await Promise.all(ids.map(async (i:number)=>{
        if (incMap[Number(i)]) { fresh[Number(i)] = incMap[Number(i)]; return; }
        try{ fresh[Number(i)] = await getIncident(i); }catch{ /* incident may be deleted */ }
      }));
      setIncMap(prev=>({...prev,...fresh}));
    }catch(e:any){
      setErr(e?.response?.data?.detail || e?.message || "Failed to load your tasks");
    }finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[myId]);

  const changeStatus=async(id:number, status:string)=>{
    setBusyId(id); setErr(null);
    try{ await updateWork(id,{status}); await load(); }
    catch(e:any){ setErr(e?.response?.data?.detail || e?.message || "Update failed"); }
    finally{ setBusyId(null); }
  };

  const total = tasks.length;
  const pending = tasks.filter(t=>t.status==="assigned").length;
  const inProgress = tasks.filter(t=>t.status==="in_progress").length;
  const completed = tasks.filter(t=>t.status==="completed").length;
  const urgent = tasks.filter(t=>{
    if(t.status!=="assigned" && t.status!=="in_progress") return false;
    const inc = incMap[t.incident_id];
    return !!inc && (inc.severity==="high"||inc.severity==="critical");
  });

  const specLabel = user?.specialization ? String(user.specialization).replaceAll("_"," ") : "";

  return <>
    <Topbar title="Worker Dashboard"/>
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header: welcome + role + specialization */}
      <div className="bg-white border border-surface-border rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div>
          <p className="text-xs text-ink-subtle uppercase tracking-wide font-semibold">Welcome back,</p>
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink mt-1">{user?.full_name || user?.email || "Worker"}</h2>
          <p className="text-sm text-ink-muted mt-1">Here is an overview of the tasks assigned to you.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-surface-page border border-surface-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Role</p>
            <p className="text-lg font-bold text-ink capitalize">{user?.role || "Worker"}</p>
          </div>
          <div className="bg-surface-page border border-surface-border rounded-xl px-4 py-3">
            <p className="text-[10px] text-ink-subtle font-semibold uppercase tracking-wide">Specialization</p>
            <p className="text-lg font-bold text-ink capitalize flex items-center gap-1.5"><HardHat size={16} className="text-ink-subtle"/>{specLabel || "General"}</p>
          </div>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Assigned Tasks" value={total} icon={<ClipboardList size={18}/>} />
        <StatCard title="Pending Tasks" value={pending} icon={<Timer size={18}/>} accent="bg-amber-50 text-amber-600"/>
        <StatCard title="In Progress" value={inProgress} icon={<Timer size={18}/>} accent="bg-brand-50 text-brand"/>
        <StatCard title="Completed" value={completed} icon={<CheckCircle2 size={18}/>} accent="bg-green-50 text-green-600"/>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm">{err}</div>}

      {/* Priority / urgent tasks */}
      {!loading && !err && urgent.length>0 && (
        <section>
          <h2 className="font-semibold text-ink mb-3 flex items-center gap-2"><AlertOctagon size={18} className="text-red-600"/> Priority / Urgent</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {urgent.slice(0,6).map(t=><WorkerTaskCard key={t.id} task={t} incident={incMap[t.incident_id]} onStatusChange={changeStatus} busy={busyId===t.id}/>)}
          </div>
        </section>
      )}

      {/* My Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-ink text-lg">My Tasks</h2>
          {tasks.length>0 && <Link to="/worker/work" className="text-brand text-sm font-medium hover:underline">View all</Link>}
        </div>
        {loading
          ? <LoadingSpinner/>
          : tasks.length===0
            ? <EmptyState title="No tasks assigned yet" desc="New work will appear here as soon as it is assigned to you."/>
            : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tasks.slice(0,6).map(t=><WorkerTaskCard key={t.id} task={t} incident={incMap[t.incident_id]} onStatusChange={changeStatus} busy={busyId===t.id}/>)}
              </div>}
      </section>
    </div>
  </>;
}
