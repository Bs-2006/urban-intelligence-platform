import axios from "axios";
import { API_BASE } from "../utils/constants";
const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use(cfg=>{
  const t=localStorage.getItem("access_token");
  if(t) cfg.headers.Authorization=`Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r=>r, err=>{
  if(err.response?.status===401){
    localStorage.removeItem("access_token");
    if(window.location.pathname!=="/login") window.location.href="/login";
  }
  return Promise.reject(err);
});
export default api;
