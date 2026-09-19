import { createContext, useEffect, useState, ReactNode } from "react";
import { User } from "../types/auth";
import { fetchMe } from "../services/authService";
import api from "../services/api";
export interface AuthState { user: User|null; token:string|null; loading:boolean; login:(t:string)=>void; logout:()=>void; refresh:()=>Promise<void>; }
export const AuthContext=createContext<AuthState>(null as any);
export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<User|null>(null);
  const [token,setToken]=useState<string|null>(()=>localStorage.getItem("access_token"));
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{
    if(!localStorage.getItem("access_token")){ setUser(null); setToken(null); setLoading(false); return; }
    try{ const me=await fetchMe(); setUser(me); }catch{
      // Token is invalid/expired — clear it so public pages are not affected
      localStorage.removeItem("access_token");
      setToken(null);
      setUser(null);
      delete api.defaults.headers.common["Authorization"];
    } finally{ setLoading(false); }
  };
  useEffect(()=>{ refresh(); },[token]);
  const login=(t:string)=>{ localStorage.setItem("access_token",t); setToken(t); };
  const logout=()=>{ localStorage.removeItem("access_token"); setToken(null); setUser(null); delete api.defaults.headers.common["Authorization"]; };
  return <AuthContext.Provider value={{user,token,loading,login,logout,refresh}}>{children}</AuthContext.Provider>;
}
