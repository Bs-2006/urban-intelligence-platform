import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import SeverityBadge from "./SeverityBadge";
import { fmtDate } from "../utils/formatters";
import { Incident } from "../types/incident";
export default function IncidentTable({incidents}:{incidents:Incident[]}){
  return <div className="overflow-x-auto bg-white rounded-xl border">
    <table className="w-full text-sm">
      <thead className="bg-gray-50 text-gray-500"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">Issue</th><th className="p-3">Source</th><th className="p-3">Severity</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Actions</th></tr></thead>
      <tbody>{incidents.map(i=>(
        <tr key={i.id} className="border-t hover:bg-gray-50">
          <td className="p-3 font-mono">#{i.id}</td>
          <td className="p-3"><p className="font-medium">{i.title}</p><p className="text-xs text-gray-500">{i.incident_type}</p></td>
          <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${i.source==="ai"?"bg-purple-100 text-purple-700":"bg-teal-100 text-teal-700"}`}>{i.source==="ai"?"AI Detected":"Citizen Report"}</span></td>
          <td className="p-3"><SeverityBadge severity={i.severity}/></td>
          <td className="p-3 text-xs">{i.location_name||i.address||"-"}</td>
          <td className="p-3"><StatusBadge status={i.status}/></td>
          <td className="p-3 text-xs">{fmtDate(i.created_at)}</td>
          <td className="p-3"><Link to={`/incidents/${i.id}`} className="text-blue-600 hover:underline text-xs">View</Link></td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}
