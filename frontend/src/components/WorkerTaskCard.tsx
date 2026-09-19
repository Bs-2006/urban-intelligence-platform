import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import SeverityBadge from "./SeverityBadge";
import { fmtDate } from "../utils/formatters";
import { MapPin, CalendarDays } from "lucide-react";

export default function WorkerTaskCard({task, incident, onStatusChange, busy}:{
  task:any;
  incident?:any;
  onStatusChange?: (id:number, status:string)=>void;
  busy?: boolean;
}){
  const sev = incident?.severity;
  const urgent = sev==="high" || sev==="critical";
  const location = incident ? (incident.location_name || incident.address || `${incident.latitude}, ${incident.longitude}`) : null;
  return <div className={`bg-white border border-surface-border rounded-xl p-4 shadow-sm flex flex-col gap-3 ${urgent?"border-red-200 ring-1 ring-red-100":""}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold text-ink truncate">{task.title}</p>
        <div className="flex gap-2 mt-1.5 flex-wrap">
          {incident && <SeverityBadge severity={sev}/>}
          {incident && <span className="px-2 py-1 rounded-full bg-surface-page text-ink-muted text-xs font-medium capitalize">{incident.incident_type.replaceAll("_"," ")}</span>}
          <StatusBadge status={task.status}/>
        </div>
      </div>
      <span className="text-xs text-ink-subtle font-medium whitespace-nowrap">#{task.id}</span>
    </div>
    <div className="text-xs text-ink-muted space-y-1">
      <p className="flex items-center gap-1.5"><MapPin size={13} className="text-ink-subtle shrink-0"/><span className="truncate">{location || "No location available"}</span></p>
      <p className="flex items-center gap-1.5"><CalendarDays size={13} className="text-ink-subtle shrink-0"/>Assigned {fmtDate(task.created_at)}</p>
      {task.due_date && <p className="flex items-center gap-1.5"><CalendarDays size={13} className="text-ink-subtle shrink-0"/>Due {fmtDate(task.due_date)}</p>}
    </div>
    <p className="text-xs text-ink-subtle line-clamp-2">{task.description || incident?.description || ""}</p>
    <div className="mt-auto flex items-center gap-2">
      {onStatusChange && task.status==="assigned" && <button onClick={()=>onStatusChange(task.id,"in_progress")} disabled={busy} className="bg-brand text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-brand-hover disabled:opacity-50 transition-colors">Start Work</button>}
      {onStatusChange && task.status==="in_progress" && <button onClick={()=>onStatusChange(task.id,"completed")} disabled={busy} className="bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-green-700 disabled:opacity-50">Complete</button>}
      <Link to={`/worker/work/${task.id}`} className="ml-auto px-3 py-1.5 border border-surface-border rounded-full text-xs font-semibold text-ink hover:bg-brand-50 hover:border-brand transition-colors">View Details</Link>
    </div>
  </div>;
}
