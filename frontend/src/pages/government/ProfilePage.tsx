import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import { fetchMe, updateMe } from "../../services/authService";
import { User, Mail, Phone, MapPin, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const [me,      setMe]      = useState<any>(null);
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [city,    setCity]    = useState("");
  const [msg,     setMsg]     = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe()
      .then(d => {
        setMe(d);
        setName(d.full_name || "");
        setPhone(d.phone || "");
        setCity(d.city || "");
        setLoading(false);
      })
      .catch((e: any) => {
        setErr(e.response?.data?.detail || e.message || "Failed to load profile");
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setMsg(""); setErr("");
    try {
      const d = await updateMe({ full_name: name, phone: phone || null, city: city || null });
      setMe((prev: any) => ({ ...prev, ...d }));
      setMsg("Saved");
    } catch (e: any) {
      setErr(e.response?.data?.detail || e.message || "Failed to save");
    }
  };

  const roleLabel = me?.role === "admin" ? "Administrator" : me?.role ?? "";

  return (
    <>
      <Topbar title="Profile" />
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading profile…</p>
        ) : err && !me ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm">{err}</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Info card */}
            <div className="bg-white border border-surface-border rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center">
                  <User size={22} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-bold text-ink">{me?.full_name || "—"}</h2>
                  <p className="text-xs text-ink-subtle">Admin account</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-ink-muted">
                  <Mail size={15} className="text-ink-subtle shrink-0" />
                  {me?.email || "—"}
                </p>
                <p className="flex items-center gap-2 text-ink-muted">
                  <Phone size={15} className="text-ink-subtle shrink-0" />
                  {me?.phone || "—"}
                </p>
                <p className="flex items-center gap-2 text-ink-muted">
                  <MapPin size={15} className="text-ink-subtle shrink-0" />
                  {me?.city || "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-surface-page border border-surface-border text-ink text-xs font-semibold">
                  Role: {roleLabel}
                </span>
                {me?.is_verified
                  ? <span className="px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold flex items-center gap-1">
                      <ShieldCheck size={13} /> Verified
                    </span>
                  : <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold">
                      Email not verified
                    </span>
                }
              </div>
              <p className="text-xs text-ink-subtle">Role cannot be changed.</p>
            </div>

            {/* Edit card */}
            <div className="bg-white border border-surface-border rounded-xl p-6 space-y-3 shadow-sm">
              <h3 className="font-semibold text-ink text-sm">Edit Details</h3>

              <label className="block text-xs font-medium text-ink-muted">Full Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-white text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />

              <label className="block text-xs font-medium text-ink-muted">Phone</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-white text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />

              <label className="block text-xs font-medium text-ink-muted">City</label>
              <input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
                className="w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-white text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />

              <button
                onClick={save}
                className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors"
              >
                Save
              </button>
              {msg && <p className="text-sm text-green-600">{msg}</p>}
              {err && <p className="text-sm text-red-600">{err}</p>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
