import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import { getRoutes } from "../../services/routeService";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
export default function RoutesPage(){
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ getRoutes({limit:50}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setData(arr); }).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="Routes"/><div className="p-6">{loading? <LoadingSpinner/> : data.length===0? <EmptyState title="No routes"/> :
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Route Number</th><th className="p-3">Name</th><th className="p-3">Start</th><th className="p-3">End</th><th className="p-3">Distance</th><th className="p-3">Active</th></tr></thead><tbody>{data.map((b:any)=><tr key={b.id} className="border-t"><td className="p-3">{b.route_number||b.id}</td><td className="p-3">{b.name||"-"}</td><td className="p-3">{b.start_location||"-"}</td><td className="p-3">{b.end_location||"-"}</td><td className="p-3">{b.distance_km||"-"}</td><td className="p-3">{String(b.is_active)}</td></tr>)}</tbody></table></div>}</div></>;
}
