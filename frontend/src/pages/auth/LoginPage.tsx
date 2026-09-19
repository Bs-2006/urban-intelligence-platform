import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { login } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Loader2, Leaf } from "lucide-react";
import api from "../../services/api";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [err,      setErr]      = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const { login: ctxLogin, user, token, loading: authLoading } = useAuth();
  const nav = useNavigate();

  if (!authLoading && token && user) {
    return <Navigate to={user.role === "worker" ? "/worker" : "/dashboard"} replace />;
  }

  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true); setErr(null);
    try {
      const data = await login(email, password);
      localStorage.setItem("access_token", data.access_token);
      ctxLogin(data.access_token);
      const me = await api.get("/users/me").then(r => r.data).catch(() => null);
      nav(me?.role === "worker" ? "/worker" : "/dashboard");
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full border border-surface-border rounded-lg pl-10 pr-4 py-3 text-sm bg-white text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition";

  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-surface-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Leaf size={15} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-ink text-[14px] tracking-tight">Urban Intelligence</span>
              <span className="text-[10px] text-ink-subtle">Civic Technology Platform</span>
            </div>
          </Link>
          <Link to="/" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          {/* Badge + heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
              <ShieldCheck size={13} /> Government Access Only
            </div>
            <h1 className="text-2xl font-extrabold text-ink tracking-tight">Government Login</h1>
            <p className="text-sm text-ink-muted mt-1">Urban Operations Center — Admin & Field Staff</p>
          </div>

          {/* Form card */}
          <div className="bg-white border border-surface-border rounded-2xl p-7 shadow-sm">
            <form onSubmit={submit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input required type="email" placeholder="admin@urban.local" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
                </div>
              </div>
              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
                </div>
              </div>
              {/* Error */}
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex gap-2 text-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{err}</span>
                </div>
              )}
              {/* Submit */}
              <button disabled={loading}
                className="w-full bg-brand text-white py-3 rounded-lg font-bold text-sm hover:bg-brand-hover transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-sm mt-1">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : <>Sign In <ArrowRight size={16} /></>}
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 pt-5 border-t border-surface-border space-y-2.5 text-center">
              <p className="text-sm text-ink-muted">
                Don't have an account?{" "}
                <Link to="/register" className="text-brand font-semibold hover:underline">Create Account</Link>
              </p>
              <p className="text-xs text-ink-subtle">
                Citizen?{" "}
                <Link to="/report" className="text-brand font-medium hover:underline">Report an Issue</Link>
                {" "}or{" "}
                <Link to="/track" className="text-brand font-medium hover:underline">Track Complaint</Link>
                {" "}— no login required.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-ink-subtle text-center mt-5">
            Protected government portal. Unauthorized access is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
