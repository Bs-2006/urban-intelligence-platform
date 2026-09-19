import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { register as registerUser, verifyEmail, resendOtp } from "../../services/authService";
import { ShieldCheck, User, Mail, Phone, Lock, AlertCircle, Loader2, ArrowRight, CheckCircle2, KeyRound, RefreshCw, AlertTriangle, Info } from "lucide-react";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "worker", label: "Worker" },
] as const;

const SPECIALIZATIONS = [
  { value: "road_maintenance", label: "Road Maintenance" },
  { value: "drainage_waterlogging", label: "Drainage / Waterlogging" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "traffic_management", label: "Traffic Management" },
  { value: "traffic_enforcement", label: "Traffic Enforcement" },
  { value: "road_safety", label: "Road Safety" },
  { value: "traffic_sign_maintenance", label: "Traffic Sign Maintenance" },
] as const;

type Role = typeof ROLES[number]["value"];

function getErrorMessage(ex:any): string {
  if (!ex?.response) return "Network error. Please check your connection and try again.";
  const detail=ex.response.data?.detail;
  if(Array.isArray(detail)) return detail.map((d:any)=>d.msg).join(", ") || "Validation error. Please review the form.";
  if(typeof detail==="string") return detail;
  return "Something went wrong. Please try again.";
}
function extractCooldown(message:string): number {
  const m=message.match(/Please wait (\d+)s/);
  return m ? parseInt(m[1], 10) : 60;
}
function parseAlreadyRegistered(ex:any): { verified: boolean } | null {
  const d=ex?.response?.data?.detail;
  if(d && typeof d==="object" && d.code==="email_already_registered") return { verified: d.is_verified===true };
  return null;
}

export default function CreateAccountPage(){
  const [fullName,setFullName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [password,setPassword]=useState("");
  const [role,setRole]=useState<Role>("admin");
  const [specialization,setSpecialization]=useState<string>("");
  const [err,setErr]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);

  const [step,setStep]=useState<"register"|"verify">("register");
  const [otp,setOtp]=useState("");
  const [otpErr,setOtpErr]=useState<string|null>(null);
  const [otpSuccess,setOtpSuccess]=useState<string|null>(null);
  const [otpLoading,setOtpLoading]=useState(false);
  const [verified,setVerified]=useState(false);
  const [cooldown,setCooldown]=useState(0);
  const [existing,setExisting]=useState<null|{verified:boolean}>(null);

  useEffect(()=>{
    if(cooldown<=0) return;
    const t=setTimeout(()=>setCooldown(c=>c-1),1000);
    return ()=>clearTimeout(t);
  },[cooldown]);

  const submit=async(e:any)=>{
    e.preventDefault(); setLoading(true); setErr(null); setExisting(null);
    try{
      const payload:any={ full_name:fullName, email, phone, password, role };
      if(role==="worker") payload.specialization=specialization;
      await registerUser(payload);
      setStep("verify");
      setOtp("");
      setOtpErr(null);
      setOtpSuccess(`Account created! We sent a 6-digit OTP to ${email}.`);
    }catch(ex:any){
      const existingInfo=parseAlreadyRegistered(ex);
      if(existingInfo){ setExisting(existingInfo); setOtp(""); setOtpErr(null); setOtpSuccess(null); }
      else{ setErr(getErrorMessage(ex)); }
    } finally{ setLoading(false); }
  };

  const doVerify=async(e:any)=>{
    e.preventDefault(); setOtpLoading(true); setOtpErr(null); setOtpSuccess(null);
    try{
      await verifyEmail(email,otp.trim());
      setVerified(true);
      setOtpSuccess("Email verified successfully! You can now log in.");
    }catch(ex:any){ setOtpErr(getErrorMessage(ex)); } finally{ setOtpLoading(false); }
  };

  const doResend=async()=>{
    setOtpLoading(true); setOtpErr(null); setOtpSuccess(null);
    try{
      await resendOtp(email);
      setStep("verify");
      setOtp("");
      setOtpSuccess("OTP resent. Please check your email.");
      setCooldown(60);
    }catch(ex:any){ setOtpErr(getErrorMessage(ex)); setCooldown(extractCooldown(getErrorMessage(ex))); } finally{ setOtpLoading(false); }
  };

  const inputCls="w-full border-2 border-surface-border rounded-xl pl-10 pr-3 py-3 text-sm focus:border-brand focus:outline-none bg-white";

  return <div className="min-h-screen bg-surface-page flex flex-col">
    <header className="bg-white border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-xs">UI</div>
          <span className="font-bold text-ink text-[15px] tracking-tight">URBAN INTELLIGENCE</span>
          <span className="hidden sm:inline text-[10px] text-ink-muted border border-surface-border rounded px-1.5 py-0.5">GOVERNMENT</span>
        </Link>
        <Link to="/" className="text-sm font-medium text-ink-muted hover:text-ink">Back to Home</Link>
      </div>
    </header>

    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-1.5 rounded-full text-xs font-semibold">
            <ShieldCheck size={14}/> Government Access Only
          </div>
          <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-ink">{verified?"Account Verified":"Create Account"}</h1>
          <p className="text-sm text-ink-muted mt-1">Admin & Worker registration</p>
        </div>

        {step==="register" && !(existing?.verified===true) && <form onSubmit={submit} className="bg-white border border-surface-border rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"/>
                <input required type="text" placeholder="Ravi Kumar" value={fullName} onChange={e=>setFullName(e.target.value)} className={inputCls}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"/>
                <input required type="email" placeholder="admin@urban.local" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"/>
                <input required type="tel" placeholder="9876543210" value={phone} onChange={e=>setPhone(e.target.value)} className={inputCls}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"/>
                <input required type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Role</label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(r=>(
                  <button key={r.value} type="button" onClick={()=>{ setRole(r.value); setSpecialization(""); }} className={`border-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${role===r.value?"border-brand bg-brand-50 text-brand-700":"border-surface-border text-ink-muted hover:border-brand-300"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {role==="worker" && <div>
              <label className="block text-sm font-semibold text-ink mb-2">Specialization</label>
              <select required value={specialization} onChange={e=>setSpecialization(e.target.value)} className="w-full border-2 border-surface-border rounded-xl px-3 py-3 text-sm focus:border-brand focus:outline-none bg-white">
                <option value="" disabled>Select a specialization</option>
                {SPECIALIZATIONS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>}
            {err&&<div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex gap-2 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0"/><span>{err}</span></div>}
            <button disabled={loading} className="w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors disabled:bg-brand-300 inline-flex items-center justify-center gap-2">
              {loading?<><Loader2 size={16} className="animate-spin"/> Creating account...</>:<>Create Account <ArrowRight size={16}/></>}
            </button>
            {existing?.verified===false && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex gap-2 text-sm text-amber-800"><Info size={16} className="mt-0.5 shrink-0"/><span>This email is already registered but not verified.</span></div>
              <button type="button" onClick={doResend} disabled={otpLoading||cooldown>0} className="mt-3 w-full border-2 border-amber-300 text-amber-800 py-3 rounded-xl font-semibold text-sm hover:border-amber-400 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <Loader2 size={16} className={otpLoading?"animate-spin":""}/> {cooldown>0?`Resend OTP in ${cooldown}s`:"Resend OTP"}
              </button>
              {otpErr&&<div className="mt-3 bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex gap-2 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0"/><span>{otpErr}</span></div>}
            </div>}
          </div>
        </form>}

        {step==="verify" && !verified && <form onSubmit={doVerify} className="bg-white border border-surface-border rounded-2xl p-6 sm:p-7 shadow-sm">
          <div className="space-y-4">
            {existing?.verified===false && <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex gap-2 text-sm"><Info size={16} className="mt-0.5 shrink-0"/><span>This email is already registered but not verified.</span></div>}
            <div className="bg-brand-50 border border-brand-200 text-brand-800 p-3 rounded-xl flex gap-2 text-sm"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/><span>{otpSuccess}</span></div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Enter 6-digit OTP</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"/>
                <input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,6))} className="w-full border-2 border-surface-border rounded-xl pl-10 pr-3 py-3 text-sm tracking-[0.5em] text-center font-bold focus:border-brand focus:outline-none bg-white"/>
              </div>
              <p className="text-[11px] text-ink-subtle mt-1.5">Sent to {email}. Valid for 5 minutes.</p>
            </div>
            {otpErr&&<div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex gap-2 text-sm"><AlertCircle size={16} className="mt-0.5 shrink-0"/><span>{otpErr}</span></div>}
            <button disabled={otpLoading} className="w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors disabled:bg-brand-300 inline-flex items-center justify-center gap-2">
              {otpLoading?<><Loader2 size={16} className="animate-spin"/> Verifying...</>:<>Verify OTP <CheckCircle2 size={16}/></>}
            </button>
            <button type="button" onClick={doResend} disabled={otpLoading||cooldown>0} className="w-full border-2 border-surface-border text-ink py-3 rounded-xl font-semibold text-sm hover:border-brand transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
              <RefreshCw size={14}/> {cooldown>0?`Resend OTP in ${cooldown}s`:"Resend OTP"}
            </button>
          </div>
        </form>}

        {existing?.verified===true && <div className="bg-white border border-surface-border rounded-2xl p-6 sm:p-7 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24}/></div>
          <h2 className="text-lg font-bold text-ink">Account Already Exists</h2>
          <p className="text-sm text-ink-muted mt-1">This email is already registered. Please login.</p>
          <Link to="/login" className="mt-6 w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors inline-flex items-center justify-center gap-2">
            Login <ArrowRight size={16}/>
          </Link>
        </div>}

        {verified && <div className="bg-white border border-surface-border rounded-2xl p-6 sm:p-7 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 text-brand flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={24}/></div>
          <h2 className="text-lg font-bold text-ink">Email Verified</h2>
          <p className="text-sm text-ink-muted mt-1">Your account is ready. You can now sign in.</p>
          <Link to="/login" className="mt-6 w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-hover transition-colors inline-flex items-center justify-center gap-2">
            Go to Login <ArrowRight size={16}/>
          </Link>
        </div>}

        <div className="mt-6">
          <p className="text-xs text-ink-muted text-center">Already have an account? <Link to="/login" className="text-brand font-semibold hover:underline">Login</Link></p>
        </div>
        <p className="text-[11px] text-ink-subtle text-center mt-4">Protected government portal. Unauthorized access is monitored.</p>
      </div>
    </div>
  </div>;
}