import api from "./api";
export const getBuses=(p:any={})=>api.get("/buses",{params:p}).then(r=>r.data);
export const createBus=(d:any)=>api.post("/buses",d).then(r=>r.data);
export const updateBus=(id:any,d:any)=>api.patch(`/buses/${id}`,d).then(r=>r.data);
