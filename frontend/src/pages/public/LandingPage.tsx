import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, AlertCircle, CheckCircle, Search, Construction,
  Camera, Lightbulb, Trash2, Droplets, Wrench, Triangle,
  ShieldCheck, Upload, Navigation, ClipboardList,
} from "lucide-react";
import IncidentMap, { BHIMAVARAM_CENTER } from "../../components/IncidentMap";
import MapScanOverlay from "../../components/MapScanOverlay";
import { getIncidents } from "../../services/incidentService";

/* ──────────────────────────────────────────────────────────────
   TiltCard  (v3 — direct useEffect attachment, clearly visible)

   Changes from the broken v1:
   • Attaches mousemove/mouseleave via useEffect, not JSX props
   • maxDeg default 6° (was 3°) — clearly perceptible
   • liftZ  default 18px (was 6px)
   • lerp   0.20 (was 0.11) — snappy enough to track in real-time
   • Shimmer written directly as element.style.background in JS
     (was CSS vars + class toggle which was invisible on white bg)
   • Removes any CSS transition from the host element on mount
     so it cannot fight the rAF loop
────────────────────────────────────────────────────────────── */
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxDeg?: number;
  liftZ?: number;
  perspective?: number;
}

function TiltCard({
  children,
  className = "",
  style = {},
  maxDeg = 6,
  liftZ = 18,
  perspective = 800,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Remove any CSS transition that could fight rAF writes */
    el.style.transition = "box-shadow 0.3s ease";
    el.style.willChange = "transform";

    /* Ensure shimmer child exists — injected once, removed on cleanup */
    let shimmer = el.querySelector<HTMLElement>(".tilt-shimmer");
    let injected = false;
    if (!shimmer) {
      shimmer = document.createElement("div");
      shimmer.className = "tilt-shimmer";
      shimmer.setAttribute("aria-hidden", "true");
      Object.assign(shimmer.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: "5",
        opacity: "0",
        transition: "opacity 0.15s ease",
      });
      el.insertBefore(shimmer, el.firstChild);
      injected = true;
    }

    /* Ensure host is non-static so shimmer positions correctly */
    if (window.getComputedStyle(el).position === "static") {
      el.style.position = "relative";
    }

    let raf: number | null = null;
    const tgt = { rx: 0, ry: 0, lz: 0, active: false };
    const cur = { rx: 0, ry: 0, lz: 0 };
    const lp = (a: number, b: number, t: number) => a + (b - a) * t;
    const LERP = 0.20;

    const shadowBase = "0 2px 8px rgba(0,0,0,0.06)";
    const shadowHover = "0 20px 44px rgba(0,0,0,0.14), 0 6px 16px rgba(37,99,235,0.08)";

    const tick = () => {
      cur.rx = lp(cur.rx, tgt.active ? tgt.rx : 0, LERP);
      cur.ry = lp(cur.ry, tgt.active ? tgt.ry : 0, LERP);
      cur.lz = lp(cur.lz, tgt.active ? liftZ : 0, LERP);

      el.style.transform =
        `perspective(${perspective}px) ` +
        `rotateX(${cur.rx.toFixed(3)}deg) ` +
        `rotateY(${cur.ry.toFixed(3)}deg) ` +
        `translateZ(${cur.lz.toFixed(2)}px)`;

      el.style.boxShadow = tgt.active ? shadowHover : shadowBase;

      const done =
        !tgt.active &&
        Math.abs(cur.rx) < 0.04 &&
        Math.abs(cur.ry) < 0.04 &&
        Math.abs(cur.lz) < 0.2;

      if (done) {
        cur.rx = 0; cur.ry = 0; cur.lz = 0;
        el.style.transform = "";
        el.style.boxShadow = shadowBase;
        if (shimmer) shimmer.style.opacity = "0";
        raf = null;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const startLoop = () => { if (raf === null) raf = requestAnimationFrame(tick); };

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      tgt.rx = -ny * maxDeg;
      tgt.ry = nx * maxDeg;
      tgt.active = true;

      if (shimmer) {
        const sx = ((e.clientX - rect.left) / rect.width) * 100;
        const sy = ((e.clientY - rect.top) / rect.height) * 100;
        shimmer.style.background =
          `radial-gradient(circle at ${sx.toFixed(1)}% ${sy.toFixed(1)}%, ` +
          `rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.09) 50%, transparent 72%)`;
        shimmer.style.opacity = "1";
      }

      startLoop();
    };

    const onLeave = () => {
      tgt.active = false;
      startLoop();
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      el.style.transform = "";
      el.style.boxShadow = "";
      el.style.willChange = "";
      el.style.transition = "";
      if (injected && shimmer && el.contains(shimmer)) el.removeChild(shimmer);
    };
  }, [maxDeg, liftZ, perspective]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   LandingPage
   Structure, content and all functionality UNCHANGED.
   TiltCard wraps all three card groups.
────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [scanActive, setScanActive] = useState(false);

  useEffect(() => {
    getIncidents({ limit: 100 })
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : (res.items ?? []);
        setIncidents(arr);
      })
      .catch(() => { });

    const handler = () => setScanActive(true);
    window.addEventListener("uia-boot-complete", handler, { once: true });
    return () => window.removeEventListener("uia-boot-complete", handler);
  }, []);

  const activeCount = incidents.length;

  // Scroll reveal — Intersection Observer (unchanged)
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observerRef.current?.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document
      .querySelectorAll(".uia-reveal, .uia-reveal-title")
      .forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const reportTypes = [
    { icon: Construction, label: "Potholes", color: "text-orange-600", bg: "bg-orange-50" },
    { icon: Wrench, label: "Damaged Roads", color: "text-red-600", bg: "bg-red-50" },
    { icon: Droplets, label: "Waterlogging", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Trash2, label: "Garbage", color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Lightbulb, label: "Streetlights", color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Triangle, label: "Damaged Signs", color: "text-indigo-600", bg: "bg-indigo-50" },
    { icon: AlertCircle, label: "Other Civic Issues", color: "text-slate-600", bg: "bg-slate-100" },
  ];

  return (
    <div className="bg-[#f8fafc]">

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid md:grid-cols-2 gap-8 items-center">

          {/* Left — text (unchanged) */}
          <div className="uia-reveal">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
              <ShieldCheck size={14} /> Citizen Portal • Village &amp; Community
            </div>
            <h1 className="text-[32px] md:text-[44px] font-extrabold leading-[0.95] text-slate-900 tracking-tight">
              See a Problem<br />in Your Village?<br />
              <span className="text-blue-600">Report It.</span>
            </h1>
            <p className="text-slate-600 text-[15px] md:text-[16px] leading-relaxed mt-4 max-w-xl">
              Report potholes, damaged roads, waterlogging and other civic issues
              in your village and help make your community better.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                to="/report"
                className="uia-btn-primary px-6 py-3 bg-blue-600 text-white rounded-full font-semibold text-sm shadow-md hover:bg-blue-700 inline-flex items-center gap-2"
                style={{
                  transition:
                    "transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s cubic-bezier(0.22,1,0.36,1), background-color 0.2s ease",
                }}
              >
                <Camera size={18} /> Report an Issue
              </Link>
              <Link
                to="/track"
                className="uia-btn-secondary px-6 py-3 bg-white border border-slate-300 text-slate-800 rounded-full font-semibold text-sm hover:bg-slate-50 inline-flex items-center gap-2"
              >
                <Search size={18} /> Track My Complaint
              </Link>
            </div>
            <div className="flex items-center gap-3 mt-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="uia-live-dot" aria-label="Live">
                  <span className="dot-core" />
                </span>
                No login required
              </span>
              <span>•</span>
              <span>Photo &amp; location supported</span>
            </div>
          </div>

          {/* Right — live map (unchanged) */}
          <div className="relative uia-reveal" style={{ transitionDelay: "120ms" }}>
            <div className="rounded-[24px] overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-3 shadow-sm">
              <div className="rounded-[18px] bg-white border border-slate-200 overflow-hidden">
                <div className="h-10 flex items-center justify-between px-4 border-b bg-slate-50">
                  <span className="text-xs font-semibold text-slate-700">
                    Village Map • Live Reports
                  </span>
                  <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                    {activeCount > 0 ? `● ${activeCount} active` : "● Live reports"}
                  </span>
                </div>
                <div className="relative">
                  <IncidentMap
                    incidents={incidents}
                    height="h-[280px]"
                    hideLegend
                    zoomControl={false}
                    publicMode
                    center={BHIMAVARAM_CENTER}
                  />
                  <MapScanOverlay active={scanActive} />
                  <div className="absolute bottom-2 left-2 right-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm z-[400]">
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-700">
                      Your report appears on the community map instantly
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="uia-float hidden md:block absolute -bottom-4 -right-2 bg-slate-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg">
              Trusted by local authorities
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT CAN YOU REPORT ───────────────────────────────── */}
      <section className="py-10 md:py-14 px-4 sm:px-6 bg-white border-t">
        <div className="max-w-6xl mx-auto">
          <h2 className="uia-reveal-title text-xl md:text-2xl font-extrabold text-slate-900">
            What Can You Report?
          </h2>
          <p
            className="uia-reveal text-sm text-slate-500 mt-1"
            style={{ transitionDelay: "60ms" }}
          >
            Tap a category to start your report
          </p>

          <div className="uia-stagger grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
            {reportTypes.map((t, i) => (
              /* TiltCard is the tiltable shell; Link sits inside — routing unchanged */
              <TiltCard
                key={t.label}
                maxDeg={6}
                liftZ={16}
                perspective={700}
                className="uia-reveal rounded-2xl"
                style={{ transitionDelay: `${i * 55}ms` }}
              >
                <Link
                  to="/report"
                  className="uia-category-card bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center group block"
                >
                  <div
                    className={`uia-card-icon w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center mb-2`}
                  >
                    <t.icon size={20} className={t.color} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 leading-tight">
                    {t.label}
                  </span>
                </Link>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="py-10 md:py-14 px-4 sm:px-6 bg-[#f8fafc] border-t">
        <div className="max-w-6xl mx-auto">
          <h2 className="uia-reveal-title text-xl md:text-2xl font-extrabold text-slate-900">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mt-6 uia-stagger">

            {/* Step 1 */}
            <TiltCard
              maxDeg={5}
              liftZ={14}
              perspective={900}
              className="uia-reveal"
            >
              <div className="uia-step-card bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                <Camera size={22} className="text-blue-600 mt-4 mb-2" />
                <h3 className="font-bold text-slate-900">Report the problem</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Capture photo, auto-fill location, add title and submit.
                </p>
              </div>
            </TiltCard>

            {/* Step 2 — connector preserved */}
            <TiltCard
              maxDeg={5}
              liftZ={14}
              perspective={900}
              className="relative uia-reveal"
              style={{ transitionDelay: "80ms" }}
            >
              <div
                className="hidden md:block absolute -left-[18px] top-1/2 -translate-y-1/2 w-[18px] overflow-hidden"
                aria-hidden="true"
                style={{ height: "2px", zIndex: 10 }}
              >
                <div style={{
                  width: "100%", height: "100%",
                  background:
                    "linear-gradient(90deg, rgba(37,99,235,0.2), rgba(37,99,235,0.5))",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: 0, height: "100%", width: "8px",
                    background: "rgba(37,99,235,0.9)", borderRadius: "1px",
                    animation: "uia-connector-travel 2.2s ease-in-out infinite",
                    animationDelay: "0.3s",
                  }} />
                </div>
              </div>
              <div className="uia-step-card bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
                <AlertCircle size={22} className="text-orange-500 mt-4 mb-2" />
                <h3 className="font-bold text-slate-900">Authorities review it</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Officials verify, prioritize and assign to field workers.
                </p>
              </div>
            </TiltCard>

            {/* Step 3 — connector preserved */}
            <TiltCard
              maxDeg={5}
              liftZ={14}
              perspective={900}
              className="relative uia-reveal"
              style={{ transitionDelay: "160ms" }}
            >
              <div
                className="hidden md:block absolute -left-[18px] top-1/2 -translate-y-1/2 w-[18px] overflow-hidden"
                aria-hidden="true"
                style={{ height: "2px", zIndex: 10 }}
              >
                <div style={{
                  width: "100%", height: "100%",
                  background:
                    "linear-gradient(90deg, rgba(37,99,235,0.2), rgba(37,99,235,0.5))",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: 0, height: "100%", width: "8px",
                    background: "rgba(37,99,235,0.9)", borderRadius: "1px",
                    animation: "uia-connector-travel 2.2s ease-in-out infinite",
                    animationDelay: "0.9s",
                  }} />
                </div>
              </div>
              <div className="uia-step-card bg-white border border-slate-200 rounded-2xl p-6">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</div>
                <CheckCircle size={22} className="text-green-600 mt-4 mb-2" />
                <h3 className="font-bold text-slate-900">Track the resolution</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Use Complaint ID to follow status until closed.
                </p>
              </div>
            </TiltCard>

          </div>
        </div>
      </section>

      {/* ── YOUR VOICE MATTERS ────────────────────────────────── */}
      <section id="about" className="py-10 md:py-14 px-4 sm:px-6 bg-white border-t">
        <div className="max-w-6xl mx-auto">
          <h2 className="uia-reveal-title text-xl md:text-2xl font-extrabold text-slate-900">
            Your Voice Matters
          </h2>
          <p
            className="uia-reveal text-sm text-slate-500 mt-1"
            style={{ transitionDelay: "60ms" }}
          >
            Built for village citizens — simple, fast, transparent
          </p>
          <div className="uia-stagger grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">

            <TiltCard maxDeg={4} liftZ={12} perspective={800}
              className="uia-reveal">
              <div className="uia-feature-card border border-slate-200 rounded-2xl p-5 flex gap-3 bg-white">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <ClipboardList size={18} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">Easy reporting</h4>
                  <p className="text-xs text-slate-600 mt-1">3 fields only to submit. Works on any phone.</p>
                </div>
              </div>
            </TiltCard>

            <TiltCard maxDeg={4} liftZ={12} perspective={800}
              className="uia-reveal"
              style={{ transitionDelay: "60ms" }}>
              <div className="uia-feature-card border border-slate-200 rounded-2xl p-5 flex gap-3 bg-white">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Upload size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">Upload a photo</h4>
                  <p className="text-xs text-slate-600 mt-1">Add evidence so workers can act faster.</p>
                </div>
              </div>
            </TiltCard>

            <TiltCard maxDeg={4} liftZ={12} perspective={800}
              className="uia-reveal"
              style={{ transitionDelay: "120ms" }}>
              <div className="uia-feature-card border border-slate-200 rounded-2xl p-5 flex gap-3 bg-white">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Navigation size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">Share location</h4>
                  <p className="text-xs text-slate-600 mt-1">One tap to use GPS or enter village name.</p>
                </div>
              </div>
            </TiltCard>

            <TiltCard maxDeg={4} liftZ={12} perspective={800}
              className="uia-reveal"
              style={{ transitionDelay: "180ms" }}>
              <div className="uia-feature-card border border-slate-200 rounded-2xl p-5 flex gap-3 bg-white">
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Search size={18} className="text-amber-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">Track your complaint</h4>
                  <p className="text-xs text-slate-600 mt-1">Check status anytime with your Complaint ID.</p>
                </div>
              </div>
            </TiltCard>

          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-8">
        <div
          className="uia-reveal max-w-6xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[24px] p-8 md:p-10 text-center text-white"
          style={{ transitionDelay: "80ms" }}
        >
          <h2 className="text-2xl md:text-3xl font-extrabold">Have You Spotted a Problem?</h2>
          <p className="text-blue-100 text-sm mt-2 max-w-xl mx-auto">
            Your report helps the panchayat and municipality fix issues faster. It takes less than a minute.
          </p>
          <Link
            to="/report"
            className="uia-btn-primary inline-flex items-center gap-2 mt-6 px-7 py-3 bg-white text-blue-700 rounded-full font-bold text-sm shadow hover:bg-slate-50"
            style={{
              transition:
                "transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <Camera size={18} /> Report an Issue
          </Link>
        </div>
      </section>

    </div>
  );
}
