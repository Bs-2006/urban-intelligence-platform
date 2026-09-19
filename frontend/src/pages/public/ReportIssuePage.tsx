import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Camera, AlertCircle, Loader2, ChevronLeft } from "lucide-react";
import api from "../../services/api";

export default function ReportIssuePage() {
  const nav = useNavigate();
  const [form, setForm] = useState<any>({
    incident_type: "pothole", severity: "medium", title: "",
    description: "", location_name: "", address: "", latitude: "", longitude: "",
  });
  const [file,            setFile]            = useState<File | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [err,             setErr]             = useState<string | null>(null);

  const upd = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const geo = () => {
    setGettingLocation(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      p => { upd("latitude", p.coords.latitude); upd("longitude", p.coords.longitude); setGettingLocation(false); },
      ()  => { setErr("Geolocation denied. Enable location or enter coordinates manually."); setGettingLocation(false); }
    );
  };

  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("incident_type", form.incident_type);
      fd.append("severity",      form.severity);
      fd.append("title",         form.title);
      if (form.description)    fd.append("description",   form.description);
      if (form.location_name)  fd.append("location_name", form.location_name);
      if (form.address)        fd.append("address",       form.address);
      fd.append("latitude",  String(form.latitude));
      fd.append("longitude", String(form.longitude));
      if (file) fd.append("file", file);
      const r = await api.post("/public/incidents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      nav("/report-success", { state: r.data });
    } catch (ex: any) {
      setErr(ex.response?.data?.detail || ex.message || "Failed to submit. Please try again.");
    } finally { setLoading(false); }
  };

  const issueTypes = [
    { value: "pothole",         label: "Pothole"              },
    { value: "damaged_road",    label: "Damaged Road"         },
    { value: "waterlogging",    label: "Waterlogging"         },
    { value: "garbage",         label: "Garbage"              },
    { value: "streetlight",     label: "Streetlight Issue"    },
    { value: "missing_divider", label: "Missing Divider"      },
    { value: "missing_zebra",   label: "Missing Zebra Crossing"},
    { value: "damaged_sign",    label: "Damaged Sign"         },
    { value: "other",           label: "Other"                },
  ];

  const inputCls = "w-full border border-surface-border rounded-lg px-4 py-2.5 text-sm bg-white text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition";
  const labelCls = "block text-sm font-semibold text-ink mb-1.5";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
        <ChevronLeft size={16} /> Back to Home
      </Link>

      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-ink">Report a Civic Issue</h1>
        <p className="text-ink-muted text-sm mt-1">Help improve your community. Fields marked <span className="text-red-500">*</span> are required.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Issue Type */}
        <div>
          <label className={labelCls}>Issue Type <span className="text-red-500">*</span></label>
          <select required value={form.incident_type} onChange={e => upd("incident_type", e.target.value)} className={inputCls}>
            {issueTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className={labelCls}>Title <span className="text-red-500">*</span></label>
          <input required placeholder="e.g., Large pothole on Main Street" value={form.title} onChange={e => upd("title", e.target.value)} className={inputCls} />
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea placeholder="More details about the issue…" value={form.description} onChange={e => upd("description", e.target.value)} rows={3} className={inputCls} />
        </div>

        {/* Location */}
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand font-semibold text-sm">
            <MapPin size={18} /> Location Information
          </div>
          <button type="button" onClick={geo} disabled={gettingLocation}
            className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {gettingLocation ? <><Loader2 size={16} className="animate-spin" /> Getting Location…</> : <><MapPin size={16} /> Use My Location</>}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Latitude <span className="text-red-500">*</span></label>
              <input required type="number" step="any" placeholder="e.g., 16.5449" value={form.latitude} onChange={e => upd("latitude", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Longitude <span className="text-red-500">*</span></label>
              <input required type="number" step="any" placeholder="e.g., 81.5212" value={form.longitude} onChange={e => upd("longitude", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Village / Location Name</label>
            <input placeholder="e.g., Gandhi Nagar" value={form.location_name} onChange={e => upd("location_name", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Address / Landmark</label>
            <input placeholder="e.g., Near Community Centre, Main Road" value={form.address} onChange={e => upd("address", e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className={labelCls + " flex items-center gap-2"}><Camera size={16} /> Upload Photo</label>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full border border-surface-border rounded-lg px-4 py-2.5 text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand hover:file:bg-brand-100 cursor-pointer" />
          {file && <p className="text-sm text-brand mt-2 flex items-center gap-1">✓ {file.name}</p>}
        </div>

        {/* Severity */}
        <div>
          <label className={labelCls}>Severity</label>
          <div className="grid grid-cols-4 gap-2">
            {["low", "medium", "high", "critical"].map(s => (
              <label key={s} className="relative cursor-pointer">
                <input type="radio" name="severity" value={s} checked={form.severity === s} onChange={e => upd("severity", e.target.value)} className="peer sr-only" />
                <div className="border border-surface-border rounded-lg py-2.5 text-center text-sm font-medium capitalize transition-colors peer-checked:bg-brand peer-checked:text-white peer-checked:border-brand hover:border-brand-300">
                  {s}
                </div>
              </label>
            ))}
          </div>
        </div>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="text-sm">{err}</span>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-brand text-white py-3.5 rounded-lg font-bold text-base hover:bg-brand-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Submitting…</> : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
