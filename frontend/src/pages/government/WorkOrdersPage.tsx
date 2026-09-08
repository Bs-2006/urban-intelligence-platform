import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import WorkOrderTable from "../../components/WorkOrderTable";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import { getWorks } from "../../services/workService";
import { Link } from "react-router-dom";
export default function WorkOrdersPage(){
  const [orders,setOrders]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ getWorks({limit:50}).then((r:any)=>{ const arr=Array.isArray(r)?r:r.items||[]; setOrders(arr); }).catch(e=>setErr(e.message)).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="Work Orders"/>
    <div className="p-6">
      {loading? <LoadingSpinner/> : err? <div className="text-red-600">{err}</div> : orders.length===0? <EmptyState title="No work orders" desc="Create work from incident details via Assign Work."/> : <WorkOrderTable orders={orders}/>}
      <div className="mt-4 text-xs text-gray-400">View details: <Link to="/work-orders/1" className="text-blue-600">example</Link></div>
    </div>
  </>;
}
