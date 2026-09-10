import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import {
  ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Loader2,
} from "lucide-react";
import api from "../../services/api";
import { use3DTilt } from "../../hooks/use3DTilt";
import { useParallax } from "../../hooks/useParallax";
import CivicMapPanel from "../../components/CivicMapPanel";

/* ──────────────────────────────────────────────────────────────
   useMagneticButton
   Attaches directly to a <button> via useEffect.
   On hover the button drifts toward the cursor (magnetic pull).
   On click it physically presses inward.
   Returns a plain ref — no JSX event props needed.
────────────────────────────────────────────────────────────── */
function useMagneticButton() {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf: number | null = null;
    const tgt = { x: 0, y: 0, active: false };
    const cur = { x: 0, y: 0 };
    const lp = (a: number, b: number, t: number) => a + (b - a) * t;

    const STRENGTH = 0.40;   // pull factor — clearly noticeable

    const tick = () => {
      cur.x = lp(cur.x, tgt.active ? tgt.x : 0, 0.18);
      cur.y = lp(cur.y, tgt.active ? tgt.y : 0, 0.18);
      btn.style.transform = `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px)`;

      const done =
        !tgt.active && Math.abs(cur.x) < 0.05 && Math.abs(cur.y) < 0.05;
      if (done) {
        cur.x = 0; cur.y = 0;
        btn.style.transform = "translate(0px,0px)";
        raf = null;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const start = () => { if (raf === null) raf = requestAnimationFrame(tick); };

    const onMove = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      tgt.x = (e.clientX - (r.left + r.width / 2)) * STRENGTH;
      tgt.y = (e.clientY - (r.top + r.height / 2)) * STRENGTH;
      tgt.active = true;
      start();
    };
    const onLeave = () => { tgt.active = false; start(); };
    const onDown = () => {
      // Physical press: move down+in slightly
      btn.style.transform =
        `translate(${cur.x.toFixed(2)}px, ${(cur.y + 3).toFixed(2)}px) scale(0.97)`;
    };
    const onUp = () => {
      btn.style.transform =
        `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px) scale(1)`;
    };

    btn.addEventListener("mousemove", onMove);
    btn.addEventListener("mouseleave", onLeave);
    btn.addEventListener("mousedown", onDown);
    btn.addEventListener("mouseup", onUp);
    btn.style.willChange = "transform";

    return () => {
      btn.removeEventListener("mousemove", onMove);
      btn.removeEventListener("mouseleave", onLeave);
      btn.removeEventListener("mousedown", onDown);
      btn.removeEventListener("mouseup", onUp);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      btn.style.transform = "";
      btn.style.willChange = "";
    };
  }, []);

  return ref;
}

/* ──────────────────────────────────────────────────────────────
   useInputFocusLift
   Attaches focus/blur listeners to the <input> inside a wrapper
   div.  On focus the whole wrapper lifts up with a blue glow.
   Returns a ref for the wrapper div.
────────────────────────────────────────────────────────────── */
function useInputFocusLift() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const input = wrap.querySelector<HTMLInputElement>("input");
    if (!input) return;

    wrap.style.transition =
      "transform 0.22s cubic-bezier(0.22,1,0.36,1), box-shadow 0.22s cubic-bezier(0.22,1,0.36,1)";
    wrap.style.borderRadius = "12px";

    const onFocus = () => {
      wrap.style.transform = "translateY(-3px)";
      wrap.style.boxShadow =
        "0 8px 22px rgba(37,99,235,0.20), 0 2px 8px rgba(37,99,235,0.12)";
    };
    const onBlur = () => {
      wrap.style.transform = "translateY(0)";
      wrap.style.boxShadow = "none";
    };

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
    };
  }, []);

  return ref;
}

/* ──────────────────────────────────────────────────────────────
   LoginPage
────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  /* ── existing state & auth logic — UNTOUCHED ── */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login: ctxLogin } = useAuth();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const data = await login(email, password);
      localStorage.setItem("access_token", data.access_token);
      ctxLogin(data.access_token);
      const me = await api.get("/users/me").then(r => r.data).catch(() => null);
      const role = me?.role;
      if (role === "worker") nav("/worker");
      else if (role === "admin" || role === "transport_officer") nav("/dashboard");
      else if (role === "citizen")
        setErr("Citizen accounts cannot access government dashboard.");
      else nav("/dashboard");
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── animation hooks ──
     use3DTilt  → returns a single ref; attaches events via useEffect
     useParallax → sceneRef on page root, getLayerRef(i, factor) per layer
     useMagneticButton → ref for the submit button
     useInputFocusLift → ref for each input wrapper div               */
  const cardRef = use3DTilt<HTMLDivElement>({
    maxDeg: 8,
    perspective: 800,
    liftZ: 22,
    lerp: 0.20,
  });

  const { sceneRef, getLayerRef } = useParallax();

  const submitBtnRef = useMagneticButton();
  const emailWrap = useInputFocusLift();
  const passWrap = useInputFocusLift();

  return (
    /* sceneRef: full-page container — mouse tracked globally */
    <div
      ref={sceneRef}
      className="min-h-screen bg-[#f8fafc] flex flex-col"
      style={{ position: "relative", overflow: "hidden" }}
    >

      {/* ── Parallax depth background ──────────────────────────
          Three depth layers with clearly perceptible factors.
          All pointer-events:none, aria-hidden.
          The hook's useEffect wires window.mousemove and drives
          translate3d on each element.                          */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          pointerEvents: "none", overflow: "hidden",
          zIndex: 0,
        }}
      >
        {/* FAR layer — factor 0.06 — large faint rings */}
        <div
          ref={getLayerRef(0, 0.06)}
          style={{
            position: "absolute",
            width: 580, height: 580,
            borderRadius: "50%",
            border: "1.5px solid rgba(37,99,235,0.10)",
            top: -120, right: -140,
          }}
        />
        <div
          ref={getLayerRef(1, 0.06)}
          style={{
            position: "absolute",
            width: 440, height: 440,
            borderRadius: "50%",
            border: "1.5px solid rgba(37,99,235,0.08)",
            bottom: -90, left: -110,
          }}
        />

        {/* MID layer — factor 0.15 — medium shapes */}
        <div
          ref={getLayerRef(2, 0.15)}
          style={{
            position: "absolute",
            width: 220, height: 220,
            border: "1.5px solid rgba(37,99,235,0.12)",
            borderRadius: "28px",
            top: "14%", right: "7%",
            transform: "rotate(15deg)",
          }}
        />
        <div
          ref={getLayerRef(3, 0.15)}
          style={{
            position: "absolute",
            width: 110, height: 110,
            border: "1.5px solid rgba(37,99,235,0.10)",
            borderRadius: "18px",
            bottom: "20%", left: "6%",
            transform: "rotate(-12deg)",
          }}
        />

        {/* NEAR layer — factor 0.28 — small vivid dots, most movement */}
        <div
          ref={getLayerRef(4, 0.28)}
          style={{
            position: "absolute",
            width: 16, height: 16,
            borderRadius: "50%",
            background: "rgba(37,99,235,0.25)",
            top: "33%", left: "14%",
          }}
        />
        <div
          ref={getLayerRef(5, 0.28)}
          style={{
            position: "absolute",
            width: 12, height: 12,
            borderRadius: "50%",
            background: "rgba(37,99,235,0.20)",
            top: "22%", right: "17%",
          }}
        />
        <div
          ref={getLayerRef(6, 0.22)}
          style={{
            position: "absolute",
            width: 20, height: 20,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.18)",
            bottom: "36%", right: "10%",
          }}
        />

        {/* Static ambient glow — no parallax, purely atmospheric */}
        <div style={{
          position: "absolute",
          top: "30%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: 700, height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 65%)",
        }} />
      </div>

      {/* ── Header — UNCHANGED ─────────────────────────────────── */}
      <header
        className="bg-white border-b"
        style={{ position: "relative", zIndex: 10 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              UI
            </div>
            <span className="font-bold text-slate-900 text-[15px] tracking-tight">
              URBAN INTELLIGENCE
            </span>
            <span className="hidden sm:inline text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">
              GOVERNMENT
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* ── Centred card area ──────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-4 py-10"
        style={{ position: "relative", zIndex: 5 }}
      >
        {/*
          Two-column layout on md+:
            Left  — existing login form (unchanged, max-w-[440px])
            Right — CivicMapPanel (dark location visual, fills the space)
          Single-column on mobile (panel hidden).
        */}
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-center">

          {/* ── LEFT: existing login column — UNTOUCHED ──────── */}
          <div className="w-full max-w-[440px] mx-auto md:mx-0">

            {/* Badge + title */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                <ShieldCheck size={14} /> Government Access Only
              </div>
              <h1 className="mt-4 text-[26px] font-extrabold tracking-tight text-slate-900">
                Government Login
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Urban Operations Center — Admin &amp; Field Staff
              </p>
            </div>

            {/* ── 3D tilt card ───────────────────────────────────────
              cardRef is the element that tilts.
              use3DTilt attaches mousemove/mouseleave via useEffect —
              no JSX event props required here.
              The hook also injects a .tilt-shimmer child automatically.  */}
            <div
              ref={cardRef}
              style={{
                borderRadius: "16px",
                /* NO CSS transition on transform — that fights the rAF loop.
                   Only box-shadow transitions, handled inside the hook.      */
                position: "relative",
              }}
            >
              {/* ── Form — 100% unchanged markup & logic ─────────── */}
              <form
                onSubmit={submit}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm"
                style={{ position: "relative", zIndex: 1 }}
              >
                <div className="space-y-4">

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Email
                    </label>
                    {/* emailWrap: lifts on focus via useInputFocusLift */}
                    <div ref={emailWrap} className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        required
                        type="email"
                        placeholder="admin@urban.local"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-3 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">
                      Password
                    </label>
                    {/* passWrap: lifts on focus via useInputFocusLift */}
                    <div ref={passWrap} className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        required
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border-2 border-slate-300 rounded-xl pl-10 pr-3 py-3 text-sm focus:border-blue-500 focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  {err && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl flex gap-2 text-sm">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  )}

                  {/* Submit — submitBtnRef wires magnetic + press via useEffect */}
                  <button
                    ref={submitBtnRef}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-full font-semibold text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 inline-flex items-center justify-center gap-2"
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                      : <>Sign In <ArrowRight size={16} /></>
                    }
                  </button>

                </div>

                <div className="mt-6 pt-6 border-t border-slate-100">
                  <p className="text-xs text-slate-500 text-center">
                    Citizen? Use{" "}
                    <Link to="/report" className="text-blue-600 font-semibold hover:underline">
                      Report an Issue
                    </Link>
                    {" "}or{" "}
                    <Link to="/track" className="text-blue-600 font-semibold hover:underline">
                      Track Complaint
                    </Link>
                    {" "}— no login required.
                  </p>
                </div>
              </form>
              {/* ── end form ──────────────────────────────────────── */}

            </div>
            {/* ── end cardRef tilt wrapper ───────────────────────── */}

            <p className="text-[11px] text-slate-400 text-center mt-4">
              Protected government portal. Unauthorized access is monitored.
            </p>
          </div>
          {/* ── LEFT column end ────────────────────────────── */}

          {/* ── RIGHT: Civic Map Panel — desktop only ──────── */}
          <div className="hidden md:block" style={{ minHeight: 520 }}>
            <CivicMapPanel />
          </div>

        </div>{/* end two-column grid */}
      </div>{/* end flex-1 centred area */}

    </div> /* end sceneRef outer div */
  );
}
