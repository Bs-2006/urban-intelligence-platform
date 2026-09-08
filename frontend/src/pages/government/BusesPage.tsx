import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import { getBuses } from "../../services/busService";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
export default function BusesPage(){
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ getBuses({limit:50}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setData(arr); }).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="Buses"/><div className="p-6">{loading? <LoadingSpinner/> : data.length===0? <EmptyState title="No buses"/> :
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Bus Number</th><th className="p-3">Route</th><th className="p-3">Capacity</th><th className="p-3">Driver</th><th className="p-3">Active</th></tr></thead><tbody>{data.map((b:any)=><tr key={b.id} className="border-t"><td className="p-3">{b.bus_number||b.id}</td><td className="p-3">{b.route_id||"-"}</td><td className="p-3">{b.capacity||"-"}</td><td className="p-3">{b.driver_name||"-"}</td><td className="p-3">{String(b.is_active)}</td></tr>)}</tbody></table></div>}</div></>;
}
