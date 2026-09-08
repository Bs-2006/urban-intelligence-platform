import api from "./api";
export async function getWorks(params:any={}){ const r=await api.get("/work",{params}); return r.data; }
export async function getWork(id:number|string){ const r=await api.get(`/work/${id}`); return r.data; }
export async function createWork(data:any){ const r=await api.post("/work",data); return r.data; }
export async function updateWork(id:number|string,data:any){ const r=await api.patch(`/work/${id}`,data); return r.data; }
