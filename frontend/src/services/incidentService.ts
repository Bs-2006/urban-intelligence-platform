import api from "./api";
import { Incident, IncidentCreate } from "../types/incident";
export async function getIncidents(params:any={}){
  const r=await api.get("/incidents",{params}); return r.data as Incident[] | {items:Incident[]};
}
export async function getIncident(id:number|string){
  const r=await api.get(`/incidents/${id}`); return r.data as Incident;
}
export async function createIncident(data:IncidentCreate){
  const r=await api.post("/incidents",data); return r.data;
}
export async function createPublicIncident(data:FormData | IncidentCreate){
  const isForm = data instanceof FormData;
  const cfg = isForm ? { headers:{ "Content-Type":"multipart/form-data"}} : {};
  const r=await api.post("/public/incidents", data as any, cfg as any); return r.data;
}
export async function getPublicIncident(id:number|string){
  const r=await api.get(`/public/incidents/${id}`); return r.data as Incident;
}
export async function updateIncident(id:number|string, data:any){
  const r=await api.patch(`/incidents/${id}`,data); return r.data;
}
export async function uploadIncidentImage(id:number|string,file:File){
  const fd=new FormData(); fd.append("file",file);
  const r=await api.post(`/incidents/${id}/image`,fd,{headers:{"Content-Type":"multipart/form-data"}}); return r.data;
}
export async function deleteIncident(id:number|string){ const r=await api.delete(`/incidents/${id}`); return r.data; }
