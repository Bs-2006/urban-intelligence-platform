import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar";
import api from "../../services/api";
import { API_BASE } from "../../utils/constants";
import { Bus, Route as RouteIcon, MapPin, Camera, AlertTriangle } from "lucide-react";

type BusRow = { id: number; bus_number: string; route_id?: number; capacity?: number; is_active?: boolean };
type RouteRow = { id: number; route_number: string; name: string; start_point?: string; end_point?: string };
type Observation = {
  id: string;
  bus_id: string;
  route_id: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  occurred_at: string | null;
  image_path: string | null;
  image_url: string | null;
  image_key: string | null;
  local_image_url: string | null;
  created_at: string | null;
  ai_incident_type?: string | null;
  incident_type?: string | null;
  category?: string | null;
};
type IncidentRow = {
  id: number;
  incident_type: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  location_name: string | null;
  latitude: number;
  longitude: number;
  ai_confidence: number | null;
  occurred_at: string | null;
  created_at: string;
  metadata_json?: Record<string, unknown>;
  image_url?: string | null;
};

export default function AiMonitoringPage() {
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedBus, setSelectedBus] = useState<string>("all");
  const [selectedRoute, setSelectedRoute] = useState<string>("all");
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnnotated, setShowAnnotated] = useState(true);

  const ALLOWED_INCIDENT_TYPES = new Set(["pothole", "damaged_road", "waterlogging"]);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, rRes, oRes, iRes] = await Promise.all([
        api.get("/buses/", { params: { limit: 50 } }),
        api.get("/routes/", { params: { limit: 50 } }),
        api.get("/api/bus-observations", { params: { limit: 20 } }),
        api.get("/incidents/", { params: { source: "ai", limit: 50 } }),
      ]);
      const bArr: BusRow[] = Array.isArray(bRes.data) ? bRes.data : bRes.data.items || [];
      const rArr: RouteRow[] = Array.isArray(rRes.data) ? rRes.data : rRes.data.items || [];
      const oArr: Observation[] = Array.isArray(oRes.data) ? oRes.data : oRes.data.items || [];
      const rawInc: IncidentRow[] = Array.isArray(iRes.data) ? iRes.data : iRes.data.items || [];
      const iArr = rawInc.filter((inc) => ALLOWED_INCIDENT_TYPES.has(inc.incident_type));
      setBuses(bArr);
      setRoutes(rArr);
      setObservations(oArr);
      setIncidents(iArr);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch {
      // silent for polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const filteredObs = observations.filter((o) => {
    if (selectedBus !== "all" && o.bus_id !== selectedBus) return false;
    if (selectedRoute !== "all" && o.route_id !== selectedRoute) return false;
    return true;
  });
  const filteredInc = incidents.filter((inc) => {
    const meta = (inc.metadata_json || {}) as Record<string, string>;
    const busStr = (meta.ai_bus_id as string) || (meta.bus_id_str as string) || "";
    const routeStr = (meta.ai_route_id as string) || (meta.route_id_str as string) || "";
    if (selectedBus !== "all" && busStr && busStr !== selectedBus) return false;
    if (selectedRoute !== "all" && routeStr && routeStr !== selectedRoute) return false;
    return true;
  });

  const latestObs: Observation | undefined = filteredObs[0] || observations[0];
  const latestInc: IncidentRow | undefined = filteredInc[0] || incidents[0];

  const getObsImageUrl = (o: Observation | undefined) => {
    if (!o) return null;
    if (o.local_image_url) return `${API_BASE}${o.local_image_url}`;
    if (o.id) return `${API_BASE}/api/bus-observations/${o.id}/image`;
    return null;
  };

  const getCategory = (o: Observation | undefined) => {
    if (!o) return "PROCESSING";
    const raw = (o.ai_incident_type || o.incident_type || o.category || "")?.toString().toLowerCase();
    if (raw === "pothole" || raw === "potholes") return "pothole";
    if (raw === "damaged_road" || raw === "road_damage") return "damaged_road";
    if (raw === "waterlogging") return "waterlogging";
    return "PROCESSING";
  };

  const formatCategory = (cat: string) => {
    if (cat === "pothole") return "POTHOLE";
    if (cat === "damaged_road") return "DAMAGED ROAD";
    if (cat === "waterlogging") return "WATERLOGGING";
    if (cat === "PROCESSING") return "PROCESSING";
    return cat.toUpperCase();
  };

  const rawImageUrl = getObsImageUrl(latestObs);

  const annotatedForObs = (() => {
    if (!latestObs) return null;
    const match = incidents.find((inc) => {
      const m = inc.metadata_json as Record<string, unknown> | undefined;
      return m && String(m.observation_id) === String(latestObs.id);
    });
    const candidate = match || latestInc;
    const m = candidate?.metadata_json as Record<string, unknown> | undefined;
    const url = (m?.annotated_image_url as string) || (m?.annotated_image_path as string) || null;
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return null;
  })();

  const hasAnnotated = !!annotatedForObs;
  const displayImageUrl = showAnnotated && hasAnnotated ? annotatedForObs : rawImageUrl;
  const showingAnnotated = !!(showAnnotated && hasAnnotated && displayImageUrl === annotatedForObs);

  return (
    <>
      <Topbar title="AI Camera Monitoring" />
      <div className="p-6 space-y-6 bg-surface-page min-h-[calc(100vh-56px)]">

        {/* ── Filter controls ── */}
        <div className="bg-white border border-surface-border rounded-xl p-4 flex flex-wrap gap-4 items-end shadow-sm">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-ink-muted flex items-center gap-1"><Bus size={12} /> Bus</label>
            <select value={selectedBus} onChange={(e) => setSelectedBus(e.target.value)} className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-brand">
              <option value="all">All buses</option>
              {buses.map((b) => (
                <option key={b.id} value={b.bus_number}>{b.bus_number}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-ink-muted flex items-center gap-1"><RouteIcon size={12} /> Route</label>
            <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="mt-1 w-full border border-surface-border rounded-lg px-3 py-2 text-sm bg-white text-ink focus:outline-none focus:border-brand">
              <option value="all">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.route_number}>{r.route_number} — {r.name}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-ink-subtle ml-auto">
            <p>Auto-refresh every 5s</p>
            {lastRefresh && <p className="text-ink font-medium">Last refresh: {lastRefresh}</p>}
          </div>
          <button onClick={fetchAll} className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand-hover transition-colors">Refresh now</button>
        </div>

        {/* ── Main split: camera feed + last detection ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Camera feed */}
          <div className="lg:col-span-2 bg-white border border-surface-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2 bg-surface-page">
              <span className="text-sm font-semibold text-ink flex items-center gap-2"><Camera size={16}/> Camera Feed</span>
              {hasAnnotated && (
                <button
                  onClick={() => setShowAnnotated((v) => !v)}
                  className={`text-[11px] px-2 py-1 rounded-full border font-medium transition-colors ${showingAnnotated ? "bg-brand text-white border-brand" : "bg-white text-ink border-surface-border hover:bg-brand-50"}`}
                >
                  {showingAnnotated ? "Showing AI annotated" : "Show AI annotated"}
                </button>
              )}
            </div>
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
              {displayImageUrl && latestObs?.image_path ? (
                <img
                  src={displayImageUrl}
                  alt={showingAnnotated ? "AI annotated frame" : "Camera frame"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    if (showingAnnotated && rawImageUrl) {
                      (e.currentTarget as HTMLImageElement).src = rawImageUrl;
                    } else {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }
                  }}
                />
              ) : (
                <div className="text-center p-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center"><Camera size={20} className="text-slate-400" /></div>
                  <p className="text-slate-200 text-sm font-medium mt-3">No camera frame available</p>
                  {latestObs && (
                    <p className="text-[11px] text-slate-500 mt-2">Latest: {latestObs.bus_id} @ {latestObs.location_name || "unknown"} · {latestObs.created_at ? new Date(latestObs.created_at).toLocaleString() : ""}</p>
                  )}
                </div>
              )}
              <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded flex items-center gap-1"><span className="w-2 h-2 bg-white rounded-full animate-pulse" /> REC</div>
              {latestObs && <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">{latestObs.bus_id} · {latestObs.route_id || "-"} · {latestObs.location_name || "-"}</div>}
              {showingAnnotated && latestInc && (
                <div className="absolute bottom-3 right-3 bg-purple-600/90 text-white text-xs px-2 py-1 rounded font-medium">
                  AI: {latestInc.incident_type.replace(/_/g, " ")} · {latestInc.ai_confidence != null ? (latestInc.ai_confidence * 100).toFixed(0) + "%" : ""} {latestInc.id ? `· #${latestInc.id}` : ""}
                </div>
              )}
            </div>
            {/* Observation details */}
            <div className="p-4 border-t border-surface-border bg-white">
              {loading ? (
                <p className="text-sm text-ink-subtle">Loading observations…</p>
              ) : latestObs ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-ink-subtle">Bus</span><p className="font-medium text-ink">{latestObs.bus_id}</p></div>
                  <div><span className="text-ink-subtle">Route</span><p className="font-medium text-ink">{latestObs.route_id || "-"}</p></div>
                  <div><span className="text-ink-subtle">Category</span><p className="font-bold" style={{ color: getCategory(latestObs) === "pothole" ? "#dc2626" : getCategory(latestObs) === "damaged_road" ? "#ea580c" : getCategory(latestObs) === "waterlogging" ? "#0284c7" : "#64748b" }}>{formatCategory(getCategory(latestObs))}</p></div>
                  <div><span className="text-ink-subtle">Location</span><p className="font-medium text-ink flex items-center gap-1"><MapPin size={10} />{latestObs.location_name || "-"}</p></div>
                  <div><span className="text-ink-subtle">GPS</span><p className="font-medium text-ink">{latestObs.latitude.toFixed(4)}, {latestObs.longitude.toFixed(4)}</p></div>
                  <div><span className="text-ink-subtle">Occurred</span><p className="font-medium text-ink">{latestObs.occurred_at ? new Date(latestObs.occurred_at).toLocaleString() : "-"}</p></div>
                  <div><span className="text-ink-subtle">Observation ID</span><p className="font-mono font-medium text-ink">{latestObs.id}</p></div>
                  <div><span className="text-ink-subtle">Image</span><p className="font-mono text-[11px] truncate text-ink-muted">{latestObs.image_path || "—"}</p></div>
                </div>
              ) : (
                <p className="text-sm text-ink-subtle">No observations yet.</p>
              )}
            </div>
          </div>

          {/* Last AI Detection */}
          <div className="bg-white border border-surface-border rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-ink uppercase flex items-center gap-1"><AlertTriangle size={12} /> Last AI Detection</p>
            {latestInc ? (
              <div className="mt-3 space-y-2 text-xs">
                <div><span className="text-ink-subtle">Incident ID</span><p className="font-mono font-bold text-ink">#{latestInc.id}</p></div>
                <div><span className="text-ink-subtle">Type</span><p className="font-medium text-ink capitalize">{latestInc.incident_type.replace(/_/g, " ")}</p></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-ink-subtle">Confidence</span><p className="font-medium text-ink">{latestInc.ai_confidence != null ? (latestInc.ai_confidence * 100).toFixed(1) + "%" : "n/a"}</p></div>
                  <div><span className="text-ink-subtle">Severity</span><p className="font-medium text-ink capitalize">{latestInc.severity}</p></div>
                </div>
                <div><span className="text-ink-subtle">Location</span><p className="font-medium text-ink flex items-center gap-1"><MapPin size={10} />{latestInc.location_name || "-"} · {latestInc.latitude.toFixed(4)}, {latestInc.longitude.toFixed(4)}</p></div>
                <div><span className="text-ink-subtle">Bus / Route</span><p className="font-medium text-ink">{String((latestInc.metadata_json as Record<string, unknown>)?.ai_bus_id || (latestInc.metadata_json as Record<string, unknown>)?.bus_id_str || "-")} · {String((latestInc.metadata_json as Record<string, unknown>)?.ai_route_id || (latestInc.metadata_json as Record<string, unknown>)?.route_id_str || "-")}</p></div>
                <div><span className="text-ink-subtle">Timestamp</span><p className="font-medium text-ink">{new Date(latestInc.created_at).toLocaleString()}</p></div>
                {hasAnnotated && <p className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1">Annotated frame available — toggle above to view.</p>}
                <Link to={`/incidents/${latestInc.id}`} className="inline-block mt-2 text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-hover transition-colors">Open incident #{latestInc.id}</Link>
              </div>
            ) : (
              <p className="text-sm text-ink-subtle mt-3">No AI incident yet. When the simulator observation is processed, detection appears here automatically.</p>
            )}
          </div>
        </div>

        {/* ── Recent Camera Observations image grid ── */}
        <div className="bg-white border border-surface-border rounded-xl p-4 shadow-sm">
          <span className="text-sm font-semibold text-ink">Recent Camera Observations</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {filteredObs.slice(0, 8).map((o) => {
              const url = getObsImageUrl(o);
              const cat = getCategory(o);
              return (
                <div key={o.id} className="border border-surface-border rounded-xl overflow-hidden bg-white">
                  <div className="aspect-video bg-slate-900 flex items-center justify-center overflow-hidden">
                    {url && o.image_path ? (
                      <img
                        src={url}
                        alt={`${cat} ${o.id}`}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <span className="text-[11px] text-slate-400">No frame</span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-bold" style={{ color: cat === "pothole" ? "#dc2626" : cat === "damaged_road" ? "#ea580c" : cat === "waterlogging" ? "#0284c7" : "#64748b" }}>{formatCategory(cat)}</p>
                    <p className="text-xs font-medium truncate text-ink">{o.bus_id} · {o.route_id || "-"}</p>
                    <p className="text-[11px] text-ink-subtle truncate">{o.location_name || "-"}</p>
                    <p className="text-[10px] text-ink-subtle font-mono">#{o.id} · {o.created_at ? new Date(o.created_at).toLocaleTimeString() : ""}</p>
                  </div>
                </div>
              );
            })}
            {filteredObs.length === 0 && <p className="text-xs text-ink-subtle col-span-4">No observations for current filter.</p>}
          </div>
        </div>

      </div>
    </>
  );
}
