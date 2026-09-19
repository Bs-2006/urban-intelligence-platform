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
    // Public paths must never be redirected to /login regardless of auth state.
    // Only redirect when the user is on a protected page and their session expired.
    const publicPaths = ["/", "/report", "/report-success", "/track", "/login", "/register", "/verify-otp"];
    const currentPath = window.location.pathname;
    const isPublicPage = publicPaths.some(p => currentPath === p || currentPath.startsWith(p + "/"));
    if(!isPublicPage){
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
  }
  return Promise.reject(err);
});
export default api;
