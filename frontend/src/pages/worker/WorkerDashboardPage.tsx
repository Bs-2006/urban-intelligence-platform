import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import WorkOrderCard from "../../components/WorkOrderCard";
import StatCard from "../../components/StatCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getWorks } from "../../services/workService";
export default function WorkerDashboardPage(){
  const [orders,setOrders]=useState<any[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ getWorks({limit:50}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setOrders(arr); }).finally(()=>setLoading(false)); },[]);
  const assigned=orders.filter(o=>o.status==="assigned").length; const prog=orders.filter(o=>o.status==="in_progress").length; const comp=orders.filter(o=>o.status==="completed").length;
  return <><Topbar title="My Dashboard"/>
    <div className="p-6 space-y-6">
      <div className="grid md:grid-cols-3 gap-4"><StatCard title="Assigned" value={assigned}/><StatCard title="In Progress" value={prog} accent="bg-blue-50 text-blue-600"/><StatCard title="Completed" value={comp} accent="bg-green-50 text-green-600"/></div>
      <div><h2 className="font-semibold mb-3">My Assigned Work</h2>{loading? <LoadingSpinner/> : orders.length===0? <EmptyState title="No work assigned"/> : <div className="grid md:grid-cols-2 gap-4">{orders.slice(0,6).map(o=><WorkOrderCard key={o.id} order={o}/>)}</div>}</div>
    </div>
  </>;
}
