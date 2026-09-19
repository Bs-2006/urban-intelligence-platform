import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import { fmtDate } from "../utils/formatters";

export default function WorkOrderTable({ orders }: { orders: any[] }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-surface-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-page text-ink-muted">
          <tr>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Title</th>
            <th className="p-3 text-left">Incident</th>
            <th className="p-3 text-left">Assignee</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Assigned</th>
            <th className="p-3 text-left">Due</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} className="border-t border-surface-border hover:bg-brand-50 transition-colors">
              <td className="p-3 font-mono text-ink">#{o.id}</td>
              <td className="p-3 font-medium text-ink">{o.title}</td>
              <td className="p-3 text-ink-muted">#{o.incident_id}</td>
              <td className="p-3 text-ink-muted">{o.assigned_to}</td>
              <td className="p-3"><StatusBadge status={o.status}/></td>
              <td className="p-3 text-xs text-ink-muted">{fmtDate(o.created_at)}</td>
              <td className="p-3 text-xs text-ink-muted">{fmtDate(o.due_date)}</td>
              <td className="p-3">
                <Link
                  to={`/work-orders/${o.id}`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
