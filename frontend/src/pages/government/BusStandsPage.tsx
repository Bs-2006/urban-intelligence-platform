import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import { getBusStands } from "../../services/busStandService";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
export default function BusStandsPage(){
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ getBusStands({limit:50}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setData(arr); }).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="Bus Stands"/><div className="p-6">{loading? <LoadingSpinner/> : data.length===0? <EmptyState title="No bus stands"/> :
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Name</th><th className="p-3">Code</th><th className="p-3">Lat/Lng</th><th className="p-3">Address</th><th className="p-3">Active</th></tr></thead><tbody>{data.map((b:any)=><tr key={b.id} className="border-t"><td className="p-3">{b.name}</td><td className="p-3">{b.code||"-"}</td><td className="p-3">{b.latitude},{b.longitude}</td><td className="p-3">{b.address||"-"}</td><td className="p-3">{String(b.is_active)}</td></tr>)}</tbody></table></div>}</div></>;
}
