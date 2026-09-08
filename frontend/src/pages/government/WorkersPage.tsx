import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/EmptyState";
import api from "../../services/api";
export default function WorkersPage(){
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState<string|null>(null);
  useEffect(()=>{ api.get("/users",{params:{limit:50}}).then(r=>{ const arr=Array.isArray(r.data)?r.data:r.data.items||[]; setData(arr); }).catch(e=>setErr(e.response?.data?.detail||e.message+" — /users endpoint may be missing for worker listing. Manually use user IDs in Assign modal.")).finally(()=>setLoading(false)); },[]);
  return <><Topbar title="Workers"/>
    <div className="p-6">{loading? <LoadingSpinner/> : err? <div className="bg-amber-50 border border-amber-200 p-4 rounded text-sm">{err}</div> : data.length===0? <EmptyState title="No workers" desc="Backend user list not available."/> :
      <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">ID</th><th className="p-3 text-left">Email</th><th className="p-3">Role</th></tr></thead><tbody>{data.map((u:any)=><tr key={u.id} className="border-t"><td className="p-3">{u.id}</td><td className="p-3">{u.email}</td><td className="p-3">{u.role}</td></tr>)}</tbody></table></div>}
    </div>
  </>;
}
