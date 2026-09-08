import api from "./api";
export async function getVehicleSecurity(params:any={}){
  const r=await api.get("/vehicle-security",{params}); return r.data as any[];
}
