import api from "./api";
export const getRoutes=(p:any={})=>api.get("/routes",{params:p}).then(r=>r.data);
export const createRoute=(d:any)=>api.post("/routes",d).then(r=>r.data);
export const updateRoute=(id:any,d:any)=>api.patch(`/routes/${id}`,d).then(r=>r.data);
