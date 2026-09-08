import { useEffect, useState } from "react";
import { getWorks } from "../services/workService";
export function useWorkOrders(params:any={}){
  const [data,setData]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ getWorks(params).then((res:any)=>{ const arr=Array.isArray(res)?res:res.items||[]; setData(arr);}).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[JSON.stringify(params)]);
  return {data,loading,error};
}
