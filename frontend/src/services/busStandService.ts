import api from "./api";
export const getBusStands=(p:any={})=>api.get("/bus-stands",{params:p}).then(r=>r.data);
export const createBusStand=(d:any)=>api.post("/bus-stands",d).then(r=>r.data);
export const updateBusStand=(id:any,d:any)=>api.patch(`/bus-stands/${id}`,d).then(r=>r.data);
