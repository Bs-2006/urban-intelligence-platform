import { useEffect, useState } from "react";
import { getIncidents } from "../services/incidentService";
import { Incident } from "../types/incident";
export function useIncidents(params:any={}){
  const [data,setData]=useState<Incident[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{ setLoading(true); getIncidents(params).then((res:any)=>{
    const arr=Array.isArray(res)?res:res.items||res.data||[]; setData(arr);
  }).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[JSON.stringify(params)]);
  return {data,loading,error};
}
