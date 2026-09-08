import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import api from "../../services/api";
export default function LoginPage(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [err,setErr]=useState<string|null>(null); const [loading,setLoading]=useState(false);
  const {login:ctxLogin}=useAuth(); const nav=useNavigate();
  const submit=async(e:any)=>{
    e.preventDefault(); setLoading(true); setErr(null);
    try{
      const data=await login(email,password);
      localStorage.setItem("access_token",data.access_token);
      ctxLogin(data.access_token);
      const me=await api.get("/users/me").then(r=>r.data).catch(()=>null);
      const role=me?.role;
      if(role==="worker") nav("/worker");
      else if(role==="admin"||role==="transport_officer") nav("/dashboard");
      else if(role==="citizen"){ setErr("Citizen accounts cannot access government dashboard."); }
      else nav("/dashboard");
    }catch(ex:any){ setErr(ex.response?.data?.detail||"Login failed"); } finally{ setLoading(false); }
  };
  return <div className="min-h-screen bg-[#f8fafc] flex flex-col">
    {/* Top bar similar to PublicLayout */}
    <header className="bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">UI</div>
          <span className="font-bold text-slate-900 text-[15px] tracking-tight">URBAN INTELLIGENCE</span>
          <span className="hidden sm:inline text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">GOVERNMENT</span>
        </Link>
        <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">Back to Home</Link>
      </div>
    </header>

    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            <ShieldCheck size={14}/> Government Access Only
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-slate-900">Government Login</h1>
          <p className="text-sm text-slate-500 mt-1">Urban Operations Center — Admin & Field Staff</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input required type="email" placeholder="admin@urban.local" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-3 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input required type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-3 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"/>
              </div>
            </div>
            {err&&<div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex gap-2 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0"/><span>{err}</span></div>}
            <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 inline-flex items-center justify-center gap-2">
              {loading?<><Loader2 size={16} className="animate-spin"/> Signing in...</>:<>Sign In <ArrowRight size={16}/></>}
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">Citizen? Use <Link to="/report" className="text-blue-600 font-semibold hover:underline">Report an Issue</Link> or <Link to="/track" className="text-blue-600 font-semibold hover:underline">Track Complaint</Link> — no login required.</p>
          </div>
        </form>
        <p className="text-[11px] text-slate-400 text-center mt-4">Protected government portal. Unauthorized access is monitored.</p>
      </div>
    </div>
  </div>;
}
