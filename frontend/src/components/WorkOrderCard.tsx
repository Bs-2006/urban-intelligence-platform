import StatusBadge from "./StatusBadge";
import { fmtDate } from "../utils/formatters";
import { Link } from "react-router-dom";
export default function WorkOrderCard({order}:{order:any}){
return <div className="bg-white border border-surface-border rounded-xl p-4 shadow-sm hover:bg-brand-50 hover:border-brand-300 transition-colors">
    <div className="flex justify-between"><p className="font-semibold text-ink">{order.title}</p><StatusBadge status={order.status}/></div>
    <p className="text-xs text-ink-muted mt-1">Incident #{order.incident_id} — Due {fmtDate(order.due_date)}</p>
    <p className="text-sm text-ink-muted mt-2 line-clamp-2">{order.description}</p>
    <Link to={`/worker/work/${order.id}`} className="text-brand text-sm mt-3 inline-block">View details →</Link>
  </div>;
}
