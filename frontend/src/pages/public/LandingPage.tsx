import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, AlertCircle, CheckCircle, Search, Construction, Camera, Lightbulb, Trash2, Droplets, Wrench, Triangle, Users2, ShieldCheck, Upload, Navigation, ClipboardList } from "lucide-react";
import IncidentMap, { BHIMAVARAM_CENTER } from "../../components/IncidentMap";
import { getIncidents } from "../../services/incidentService";

export default function LandingPage(){
  const [incidents, setIncidents] = useState<any[]>([]);
  useEffect(()=>{
    getIncidents({limit: 100}).then((res:any)=>{
      const arr = Array.isArray(res) ? res : res.items || [];
      setIncidents(arr);
    }).catch(()=>{});
  },[]);
  const activeCount = incidents.length;
  const reportTypes = [
    { icon: Construction, label: "Potholes", color: "text-orange-600", bg:"bg-orange-50" },
    { icon: Wrench, label: "Damaged Roads", color: "text-red-600", bg:"bg-red-50" },
    { icon: Droplets, label: "Waterlogging", color: "text-blue-600", bg:"bg-blue-50" },
    { icon: Trash2, label: "Garbage", color: "text-emerald-600", bg:"bg-emerald-50" },
    { icon: Lightbulb, label: "Streetlights", color: "text-amber-600", bg:"bg-amber-50" },
    { icon: Triangle, label: "Damaged Signs", color: "text-indigo-600", bg:"bg-indigo-50" },
    { icon: AlertCircle, label: "Other Civic Issues", color: "text-slate-600", bg:"bg-slate-100" },
  ];

  return <div className="bg-[#f8fafc]">
    {/* HERO - two column */}
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
            <ShieldCheck size={14}/> Citizen Portal • Village & Community
          </div>
          <h1 className="text-[32px] md:text-[44px] font-extrabold leading-[0.95] text-slate-900 tracking-tight">
            See a Problem<br/>in Your Village?<br/><span className="text-blue-600">Report It.</span>
          </h1>
          <p className="text-slate-600 text-[15px] md:text-[16px] leading-relaxed mt-4 max-w-xl">
            Report potholes, damaged roads, waterlogging and other civic issues in your village and help make your community better.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link to="/report" className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold text-sm shadow-md hover:bg-blue-700 inline-flex items-center gap-2">
              <Camera size={18}/> Report an Issue
            </Link>
            <Link to="/track" className="px-6 py-3 bg-white border border-slate-300 text-slate-800 rounded-full font-semibold text-sm hover:bg-slate-50 inline-flex items-center gap-2">
              <Search size={18}/> Track My Complaint
            </Link>
          </div>
          <div className="flex items-center gap-3 mt-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full"/> No login required</span>
            <span>•</span><span>Photo & location supported</span>
          </div>
        </div>
        {/* Visual / live map */}
        <div className="relative">
          <div className="rounded-[24px] overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-3 shadow-sm">
            <div className="rounded-[18px] bg-white border border-slate-200 overflow-hidden">
              <div className="h-10 flex items-center justify-between px-4 border-b bg-slate-50">
                <span className="text-xs font-semibold text-slate-700">Village Map • Live Reports</span>
                <span className="text-[11px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">{activeCount > 0 ? `● ${activeCount} active` : "● Live reports"}</span>
              </div>
              <div className="relative">
                <IncidentMap incidents={incidents} height="h-[280px]" hideLegend zoomControl={false} publicMode center={BHIMAVARAM_CENTER} />
                <div className="absolute bottom-2 left-2 right-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm z-[400]">
                  <MapPin size={14} className="text-blue-600 shrink-0"/>
                  <span className="text-xs font-medium text-slate-700">Your report appears on the community map instantly</span>
                </div>
              </div>
            </div>
          </div>
          <div className="hidden md:block absolute -bottom-4 -right-2 bg-slate-900 text-white text-xs px-3 py-2 rounded-xl shadow-lg">Trusted by local authorities</div>
        </div>
      </div>
    </section>

    {/* What Can You Report */}
    <section className="py-10 md:py-14 px-4 sm:px-6 bg-white border-t">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">What Can You Report?</h2>
        <p className="text-sm text-slate-500 mt-1">Tap a category to start your report</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          {reportTypes.map((t)=>(
            <Link key={t.label} to="/report" className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center text-center hover:border-blue-300 hover:shadow-sm transition-all group">
              <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center mb-2 group-hover:scale-105 transition-transform`}><t.icon size={20} className={t.color}/></div>
              <span className="text-xs font-semibold text-slate-700 leading-tight">{t.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>

    {/* How It Works */}
    <section className="py-10 md:py-14 px-4 sm:px-6 bg-[#f8fafc] border-t">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
            <Camera size={22} className="text-blue-600 mt-4 mb-2"/>
            <h3 className="font-bold text-slate-900">Report the problem</h3>
            <p className="text-sm text-slate-600 mt-1">Capture photo, auto-fill location, add title and submit.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
            <AlertCircle size={22} className="text-orange-500 mt-4 mb-2"/>
            <h3 className="font-bold text-slate-900">Authorities review it</h3>
            <p className="text-sm text-slate-600 mt-1">Officials verify, prioritize and assign to field workers.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">3</div>
            <CheckCircle size={22} className="text-green-600 mt-4 mb-2"/>
            <h3 className="font-bold text-slate-900">Track the resolution</h3>
            <p className="text-sm text-slate-600 mt-1">Use Complaint ID to follow status until closed.</p>
          </div>
        </div>
      </div>
    </section>

    {/* Your Voice Matters */}
    <section id="about" className="py-10 md:py-14 px-4 sm:px-6 bg-white border-t">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900">Your Voice Matters</h2>
        <p className="text-sm text-slate-500 mt-1">Built for village citizens — simple, fast, transparent</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="border border-slate-200 rounded-2xl p-5 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><ClipboardList size={18} className="text-blue-600"/></div>
            <div><h4 className="font-semibold text-sm text-slate-900">Easy reporting</h4><p className="text-xs text-slate-600 mt-1">3 fields only to submit. Works on any phone.</p></div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0"><Upload size={18} className="text-indigo-600"/></div>
            <div><h4 className="font-semibold text-sm text-slate-900">Upload a photo</h4><p className="text-xs text-slate-600 mt-1">Add evidence so workers can act faster.</p></div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><Navigation size={18} className="text-emerald-600"/></div>
            <div><h4 className="font-semibold text-sm text-slate-900">Share location</h4><p className="text-xs text-slate-600 mt-1">One tap to use GPS or enter village name.</p></div>
          </div>
          <div className="border border-slate-200 rounded-2xl p-5 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><Search size={18} className="text-amber-600"/></div>
            <div><h4 className="font-semibold text-sm text-slate-900">Track your complaint</h4><p className="text-xs text-slate-600 mt-1">Check status anytime with your Complaint ID.</p></div>
          </div>
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[24px] p-8 md:p-10 text-center text-white">
        <h2 className="text-2xl md:text-3xl font-extrabold">Have You Spotted a Problem?</h2>
        <p className="text-blue-100 text-sm mt-2 max-w-xl mx-auto">Your report helps the panchayat and municipality fix issues faster. It takes less than a minute.</p>
        <Link to="/report" className="inline-flex items-center gap-2 mt-6 px-7 py-3 bg-white text-blue-700 rounded-full font-bold text-sm shadow hover:bg-slate-50">
          <Camera size={18}/> Report an Issue
        </Link>
      </div>
    </section>
  </div>;
}
