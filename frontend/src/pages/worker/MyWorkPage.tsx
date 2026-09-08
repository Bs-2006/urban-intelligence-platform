import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import WorkOrderCard from "../../components/WorkOrderCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getWorks } from "../../services/workService";
export default function MyWorkPage(){
  const [orders,setOrders]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ getWorks({limit:100}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setOrders(arr); }).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="My Work"/><div className="p-6">{loading? <LoadingSpinner/> : orders.length===0? <EmptyState title="No work"/> : <div className="grid md:grid-cols-2 gap-4">{orders.map(o=><WorkOrderCard key={o.id} order={o}/>)}</div>}</div></>;
}
