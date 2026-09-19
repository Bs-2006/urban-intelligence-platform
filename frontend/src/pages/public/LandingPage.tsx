import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, AlertCircle, CheckCircle, Search, Construction,
  Camera, Lightbulb, Trash2, Droplets, Wrench, Triangle,
  ShieldCheck, Upload, Navigation, ClipboardList,
  ArrowRight, Leaf,
} from "lucide-react";
import IncidentMap, { BHIMAVARAM_CENTER } from "../../components/IncidentMap";

// NOTE: /incidents requires auth — public page renders map with no markers
// to avoid 401 → login redirect.
export default function LandingPage() {
  const [incidents] = useState<any[]>([]);

  const reportTypes = [
    { icon: Construction, label: "Potholes",        color: "text-orange-600", bg: "bg-orange-50" },
    { icon: Wrench,       label: "Damaged Roads",   color: "text-red-600",    bg: "bg-red-50"    },
    { icon: Droplets,     label: "Waterlogging",    color: "text-blue-600",   bg: "bg-blue-50"   },
    { icon: Trash2,       label: "Garbage",         color: "text-brand",      bg: "bg-brand-50"  },
    { icon: Lightbulb,    label: "Streetlights",    color: "text-amber-600",  bg: "bg-amber-50"  },
    { icon: Triangle,     label: "Damaged Signs",   color: "text-purple-600", bg: "bg-purple-50" },
    { icon: AlertCircle,  label: "Other Issues",    color: "text-gray-500",   bg: "bg-gray-100"  },
  ];

  const howItWorks = [
    {
      step: "01",
      icon: Camera,
      iconBg: "bg-brand-50",
      iconColor: "text-brand",
      title: "Report the Problem",
      desc: "Capture a photo, auto-fill your GPS location, add a short title and submit — takes less than 60 seconds.",
    },
    {
      step: "02",
      icon: ShieldCheck,
      iconBg: "bg-brand-50",
      iconColor: "text-brand",
      title: "Authorities Review",
      desc: "Officials verify, prioritise by severity and assign the task to a field worker through the operations portal.",
    },
    {
      step: "03",
      icon: CheckCircle,
      iconBg: "bg-green-50",
      iconColor: "text-brand",
      title: "Track Resolution",
      desc: "Use your unique Complaint ID to follow the status in real time — from assigned to in-progress to resolved.",
    },
  ];

  return (
    <div className="bg-surface-page">

      {/* ════════ HERO ════════ */}
      <section className="bg-surface-page">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          {/* Left copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-full text-xs font-semibold mb-5">
              <Leaf size={12} /> Citizen Portal · Village & Community
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-ink tracking-tight">
              See a Problem<br />
              in Your Village?<br />
              <span className="text-brand">Report It.</span>
            </h1>
            <p className="text-ink-muted text-base leading-relaxed mt-5 max-w-lg">
              Report potholes, damaged roads, waterlogging and other civic issues.
              Help your community get faster resolutions.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link
                to="/report"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-brand-hover transition-colors"
              >
                <Camera size={17} /> Report an Issue
              </Link>
              <Link
                to="/track"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-ink border border-surface-border rounded-lg font-semibold text-sm hover:bg-surface-subtle transition-colors"
              >
                <Search size={17} /> Track My Complaint
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-6 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand" /> No login required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand" /> Photo upload supported
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand" /> GPS auto-fill
              </span>
            </div>
          </div>

          {/* Right: map */}
          <div className="flex flex-col gap-3">
            {/* Single map frame — IncidentMap provides its own border/rounding.
                hide-leaflet-attribution CSS class suppresses the Leaflet © label. */}
            <div className="relative hide-leaflet-attribution rounded-2xl overflow-hidden shadow-md">
              <IncidentMap
                incidents={incidents}
                height="h-[300px] md:h-[340px]"
                hideLegend
                zoomControl={false}
                publicMode
                center={BHIMAVARAM_CENTER}
              />
              {/* Floating info overlay — inside the map container, z-index above Leaflet layers */}
              <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm border border-surface-border rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm" style={{ zIndex: 10 }}>
                <MapPin size={14} className="text-brand shrink-0" />
                <span className="text-xs font-medium text-ink">Your report appears on the community map instantly</span>
              </div>
            </div>
            {/* Trusted badge — inline below the map, no overflow */}
            <div className="self-end inline-flex items-center gap-1.5 bg-brand text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm">
              <ShieldCheck size={13} /> Trusted by local authorities
            </div>
          </div>
        </div>
      </section>

      {/* ════════ WHAT CAN YOU REPORT ════════ */}
      <section className="py-14 px-4 sm:px-6 bg-surface-subtle border-t border-surface-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink">What Can You Report?</h2>
            <p className="text-ink-muted mt-1 text-sm">Tap a category to start your report instantly.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {reportTypes.map(t => (
              <Link
                key={t.label}
                to="/report"
                className="bg-white border border-surface-border rounded-xl p-4 flex flex-col items-center text-center hover:border-brand hover:shadow-sm hover:-translate-y-0.5 transition-all group"
              >
                <div className={`w-11 h-11 rounded-xl ${t.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <t.icon size={20} className={t.color} />
                </div>
                <span className="text-xs font-semibold text-ink leading-tight">{t.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section className="py-14 px-4 sm:px-6 bg-surface-page border-t border-surface-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink">How It Works</h2>
            <p className="text-ink-muted mt-2 text-sm max-w-xl mx-auto">
              Three simple steps from spotting a problem to seeing it resolved.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {howItWorks.map((item, i) => (
              <div
                key={item.step}
                className="relative bg-white border border-surface-border rounded-2xl p-7 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                {/* Step number */}
                <span className="absolute top-5 right-6 text-4xl font-black text-surface-muted select-none">
                  {item.step}
                </span>
                {/* Icon */}
                <div className={`w-12 h-12 ${item.iconBg} rounded-xl flex items-center justify-center mb-5`}>
                  <item.icon size={22} className={item.iconColor} />
                </div>
                <h3 className="font-bold text-ink text-base mb-2">{item.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{item.desc}</p>
                {/* Connector arrow between cards */}
                {i < howItWorks.length - 1 && (
                  <div className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-surface-border rounded-full items-center justify-center shadow-sm">
                    <ArrowRight size={14} className="text-brand" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ YOUR VOICE MATTERS ════════ */}
      <section id="about" className="py-14 px-4 sm:px-6 bg-surface-subtle border-t border-surface-border">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-ink">Your Voice Matters</h2>
            <p className="text-ink-muted mt-1 text-sm">Built for village citizens — simple, fast, transparent.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ClipboardList, color: "text-brand", bg: "bg-brand-50", title: "Easy reporting", body: "Just 3 fields to submit. Works on any phone." },
              { icon: Upload,        color: "text-brand",      bg: "bg-brand-50",  title: "Upload a photo",    body: "Add evidence so field workers can act faster." },
              { icon: Navigation,    color: "text-brand",      bg: "bg-brand-50",  title: "Share location",    body: "One tap for GPS or type your village name." },
              { icon: Search,        color: "text-amber-600",  bg: "bg-amber-50",  title: "Track your complaint", body: "Check status anytime with your Complaint ID." },
            ].map(f => (
              <div key={f.title} className="bg-white border border-surface-border rounded-xl p-5 flex gap-4 hover:shadow-sm transition-shadow">
                <div className={`w-10 h-10 ${f.bg} rounded-xl flex items-center justify-center shrink-0`}>
                  <f.icon size={18} className={f.color} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-ink">{f.title}</h4>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="py-14 px-4 sm:px-6 bg-brand">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl md:text-4xl font-extrabold leading-tight">
            Have You Spotted a Problem?
          </h2>
          <p className="text-brand-100 text-sm md:text-base mt-3 max-w-xl mx-auto leading-relaxed">
            Your report helps the panchayat and municipality fix issues faster.
            It takes less than a minute.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-brand font-bold text-sm rounded-lg shadow hover:bg-brand-50 transition-colors"
            >
              <Camera size={17} /> Report an Issue
            </Link>
            <Link
              to="/track"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-transparent text-white font-semibold text-sm rounded-lg border border-white/30 hover:bg-white/10 transition-colors"
            >
              <Search size={17} /> Track Complaint
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
