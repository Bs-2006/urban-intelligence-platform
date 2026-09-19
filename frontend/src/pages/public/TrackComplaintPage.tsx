import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, AlertCircle, CheckCircle, Clock, MapPin, FileText, XCircle, ChevronLeft } from "lucide-react";
import { getPublicIncident } from "../../services/incidentService";
import type { Incident } from "../../types/incident";

export default function TrackComplaintPage() {
  const [complaintId, setComplaintId] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [incident,    setIncident]    = useState<Incident | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintId.trim()) { setError("Please enter a complaint ID"); return; }
    setLoading(true); setError(null); setIncident(null);
    try {
      setIncident(await getPublicIncident(complaintId));
    } catch (ex: any) {
      setError(ex.response?.status === 404
        ? "Complaint not found. Please check the ID and try again."
        : ex.response?.data?.detail || "Failed to fetch complaint details.");
    } finally { setLoading(false); }
  };

  const statusIcon = (s: string) => {
    if (s === "reported" || s === "pending")         return <Clock       size={20} className="text-yellow-600" />;
    if (s === "in_progress")                          return <Loader2     size={20} className="text-brand"   />;
    if (s === "resolved" || s === "closed")           return <CheckCircle size={20} className="text-brand"      />;
    if (s === "rejected")                             return <XCircle     size={20} className="text-red-600"    />;
    return <AlertCircle size={20} className="text-ink-muted" />;
  };

  const statusBg = (s: string) => {
    if (s === "reported" || s === "pending") return "bg-yellow-50 border-yellow-200 text-yellow-800";
    if (s === "in_progress")                 return "bg-brand-50 border-brand-200 text-brand-800";
    if (s === "resolved" || s === "closed")  return "bg-brand-50 border-brand-200 text-brand-800";
    if (s === "rejected")                    return "bg-red-50 border-red-200 text-red-800";
    return "bg-surface-subtle border-surface-border text-ink-muted";
  };

  const timelineDot = (active: boolean, danger?: boolean) =>
    `w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? (danger ? "bg-red-500" : "bg-brand") : "bg-surface-muted"}`;

  const detailBox = (label: string, value: React.ReactNode) => (
    <div className="bg-surface-subtle border border-surface-border rounded-lg p-4">
      <p className="text-xs text-ink-muted mb-1 font-medium uppercase tracking-wide">{label}</p>
      <div className="font-semibold text-ink text-sm">{value}</div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
        <ChevronLeft size={16} /> Back to Home
      </Link>

      <div className="mb-7">
        <h1 className="text-3xl font-extrabold text-ink">Track Your Complaint</h1>
        <p className="text-ink-muted text-sm mt-1">Enter your Complaint ID to check current status.</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="bg-white border border-surface-border rounded-2xl p-6 shadow-sm mb-6">
        <label className="block text-sm font-semibold text-ink mb-2">Complaint ID / Incident ID</label>
        <div className="flex gap-2">
          <input type="text" value={complaintId} onChange={e => setComplaintId(e.target.value)}
            placeholder="Enter your complaint ID (e.g., 123)"
            className="flex-1 border border-surface-border rounded-lg px-4 py-2.5 text-sm bg-white text-ink placeholder-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand transition" />
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-brand text-white rounded-lg font-semibold text-sm hover:bg-brand-hover transition-colors disabled:opacity-60 flex items-center gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Searching…</> : <><Search size={16} /> Search</>}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Result */}
      {incident && (
        <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden">
          {/* Header strip */}
          <div className="bg-surface-subtle border-b border-surface-border px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-ink-muted" />
              <div>
                <h2 className="font-bold text-ink text-lg">Complaint #{incident.id}</h2>
                <p className="text-xs text-ink-muted">
                  Submitted {new Date(incident.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${statusBg(incident.status)}`}>
              {statusIcon(incident.status)} {incident.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="p-6 space-y-6">
            {/* Timeline */}
            <div className="bg-surface-subtle border border-surface-border rounded-xl p-5">
              <h3 className="font-semibold text-ink text-sm mb-4">Status Timeline</h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Reported", sub: "Complaint submitted",
                    done: true,
                    danger: false,
                    lineActive: incident.status !== "reported",
                  },
                  {
                    label: incident.status === "rejected" ? "Rejected" : "Under Review / In Progress",
                    sub: incident.status === "rejected" ? "Complaint reviewed and rejected"
                      : ["in_progress","resolved","closed"].includes(incident.status) ? "Work assigned to field team"
                      : "Pending review by authorities",
                    done: ["in_progress","resolved","closed","rejected"].includes(incident.status),
                    danger: incident.status === "rejected",
                    lineActive: ["resolved","closed"].includes(incident.status),
                  },
                  {
                    label: "Resolved", sub: ["resolved","closed"].includes(incident.status) ? "Issue fixed and closed" : "Not yet resolved",
                    done: ["resolved","closed"].includes(incident.status),
                    danger: false,
                    lineActive: false,
                  },
                ].map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={timelineDot(step.done, step.danger)}>
                        {step.done
                          ? step.danger
                            ? <XCircle size={16} className="text-white" />
                            : <CheckCircle size={16} className="text-white" />
                          : <Clock size={14} className="text-ink-subtle" />}
                      </div>
                      {i < 2 && <div className={`w-0.5 h-10 mt-1 ${step.lineActive ? "bg-brand" : "bg-surface-muted"}`} />}
                    </div>
                    <div className="pt-1">
                      <p className="font-semibold text-ink text-sm">{step.label}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{step.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details grid */}
            <div>
              <h3 className="font-semibold text-ink text-sm mb-3">Complaint Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {detailBox("Issue Type", <span className="capitalize">{incident.incident_type.replace(/_/g, " ")}</span>)}
                {detailBox("Severity", <span className="capitalize">{incident.severity}</span>)}
                {detailBox("Title", incident.title)}
                {incident.description && detailBox("Description", incident.description)}
                {detailBox("Location", (
                  <div>
                    <div className="flex items-center gap-1.5"><MapPin size={13} className="text-ink-muted" />{incident.location_name || incident.address || "Not specified"}</div>
                    <p className="text-xs text-ink-muted mt-1">{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</p>
                  </div>
                ))}
                {detailBox("Source", (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${incident.source === "citizen" ? "bg-brand-50 text-brand-700" : "bg-purple-50 text-purple-700"}`}>
                    {incident.source === "citizen" ? "👤 Citizen Report" : "🤖 AI Detection"}
                  </span>
                ))}
              </div>
            </div>

            {incident.image_url && (
              <div>
                <p className="text-sm font-semibold text-ink mb-2">Submitted Photo</p>
                <img src={incident.image_url} alt="Incident evidence" className="rounded-xl border border-surface-border max-h-80 w-full object-cover shadow-sm" />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-surface-border">
              <Link to="/report" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors">
                <AlertCircle size={16} /> Report Another Issue
              </Link>
              <Link to="/" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-surface-border text-ink rounded-lg text-sm font-semibold hover:bg-surface-subtle transition-colors">
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Help */}
      {!incident && !error && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 mt-6">
          <h3 className="font-bold text-brand-800 text-sm mb-3">How to Find Your Complaint ID?</h3>
          <ul className="space-y-2 text-sm text-brand-700">
            <li className="flex gap-2"><span className="text-brand font-bold">·</span> It was displayed on the success page after submitting your report.</li>
            <li className="flex gap-2"><span className="text-brand font-bold">·</span> It's a numeric ID like 123 or 456.</li>
            <li className="flex gap-2"><span className="text-brand font-bold">·</span> Lost it? Contact your local government office.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
