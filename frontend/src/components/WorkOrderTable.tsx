import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import { fmtDate } from "../utils/formatters";
export default function WorkOrderTable({orders}:{orders:any[]}){
  return <div className="overflow-x-auto bg-white rounded-xl border"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">Title</th><th className="p-3">Incident</th><th className="p-3">Assignee</th><th className="p-3">Status</th><th className="p-3">Due</th><th className="p-3">Actions</th></tr></thead>
  <tbody>{orders.map(o=><tr key={o.id} className="border-t"><td className="p-3">#{o.id}</td><td className="p-3 font-medium">{o.title}</td><td className="p-3">#{o.incident_id}</td><td className="p-3">{o.assigned_to}</td><td className="p-3"><StatusBadge status={o.status}/></td><td className="p-3 text-xs">{fmtDate(o.due_date)}</td><td className="p-3"><Link to={`/work-orders/${o.id}`} className="text-blue-600 text-xs">View</Link></td></tr>)}</tbody></table></div>;
}
