import { Incident } from "../types/incident";
import StatusBadge from "./StatusBadge";
import SeverityBadge from "./SeverityBadge";
export default function IncidentDetailsModal({incident,onClose}:{incident:Incident; onClose:()=>void}){
  return <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
<div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl border border-surface-border">
      <div className="flex justify-between"><h3 className="font-semibold text-ink">{incident.title}</h3><button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">✕</button></div>
      <div className="flex gap-2 mt-2"><StatusBadge status={incident.status}/><SeverityBadge severity={incident.severity}/></div>
      <p className="text-sm mt-3 text-ink">{incident.description}</p>
      {incident.image_url && <img src={incident.image_url} alt="evidence" className="mt-3 rounded max-h-64 w-full object-cover border border-surface-border"/>}
    </div>
  </div>;
}
