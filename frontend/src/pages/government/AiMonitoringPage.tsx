import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Topbar from "../../components/Topbar";
import api from "../../services/api";
import { API_BASE } from "../../utils/constants";
import { Video, Cpu, Database, Bus, Route as RouteIcon, MapPin, Clock, Shield, Activity, Camera, AlertTriangle } from "lucide-react";

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

  // Road-condition scope: only pothole / damaged_road / waterlogging
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
      // Frontend safety filter: show only road-condition types
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
    // No AI result yet
    return "PROCESSING";
  };
  const formatCategory = (cat: string) => {
    if (cat === "pothole") return "POTHOLE";
    if (cat === "damaged_road") return "DAMAGED ROAD";
    if (cat === "waterlogging") return "WATERLOGGING";
    if (cat === "PROCESSING") return "PROCESSING";
    return cat.toUpperCase();
  };

  // Resolve raw simulator frame URL via backend local media (no Supabase)
  const rawImageUrl = getObsImageUrl(latestObs);

  // Try to find annotated image for the latest observation
  // Incidents store observation_id in metadata_json.observation_id and annotated_image_url.
  const annotatedForObs = (() => {
    if (!latestObs) return null;
    const match = incidents.find((inc) => {
      const m = inc.metadata_json as Record<string, unknown> | undefined;
      return m && String(m.observation_id) === String(latestObs.id);
    });
    // fallback: if no exact observation match, use latestInc's annotated if it exists
    const candidate = match || latestInc;
    const m = candidate?.metadata_json as Record<string, unknown> | undefined;
    const url = (m?.annotated_image_url as string) || (m?.annotated_image_path as string) || null;
    if (!url) return null;
    // url may be http://localhost:8001/annotated/... or absolute file path
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    // file path -> not directly servable; ignore
    return null;
  })();

  const hasAnnotated = !!annotatedForObs;
  // Decide which image to show: annotated if available and toggle enabled
  const displayImageUrl = showAnnotated && hasAnnotated ? annotatedForObs : rawImageUrl;
  const showingAnnotated = !!(showAnnotated && hasAnnotated && displayImageUrl === annotatedForObs);
  const showingRaw = !!rawImageUrl && !showingAnnotated;

  const pipelineSteps = [
    { label: "Simulated Bus Camera", sub: "simulator.py", icon: Camera, color: "bg-blue-600" },
    { label: "Bus Observation", sub: "POST /api/bus-observations", icon: Bus, color: "bg-slate-700" },
    { label: "AI / YOLO", sub: "pothole-ai worker", icon: Cpu, color: "bg-amber-600" },
    { label: "Detection", sub: "confidence + bbox", icon: Activity, color: "bg-purple-600" },
    { label: "Incident", sub: "POST /api/ai/incidents", icon: AlertTriangle, color: "bg-red-600" },
    { label: "PostgreSQL", sub: "incidents table", icon: Database, color: "bg-emerald-600" },
    { label: "Dashboard", sub: "this page", icon: Shield, color: "bg-blue-800" },
  ];

  return (
    <>
      <Topbar title="AI Camera Monitoring" />
      <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-56px)]">
        {/* Prototype vs Production banner */}
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Shield size={16} className="text-blue-600" /> Prototype Architecture (Simulator substitutes physical camera)
          </div>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium text-slate-700">Production:</span> Physical Bus Camera → Observation API → AI/YOLO → Incident API → PostgreSQL → Government Dashboard
          </p>
          <p className="text-xs text-blue-700 mt-1 font-medium">
            Prototype: Simulator → POST /api/bus-observations → AI/YOLO → POST /api/ai/incidents → PostgreSQL → This dashboard <span className="font-normal text-gray-500">(polls /api/bus-observations + /incidents?source=ai)</span>
          </p>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
            This page uses the <span className="font-semibold">existing simulator + AI pipeline</span> only. No second detection pipeline. No frontend-generated fake incidents. No Supabase dependency.
            Raw simulator frames are served via <code className="bg-white border px-1 rounded">GET /api/bus-observations/{"{id}"}/image</code> (local <code>backend/local_media</code>), annotated frames via existing AI <code>/annotated</code> output.
          </div>
        </div>

        {/* Pipeline visualization */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Live Pipeline</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {pipelineSteps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center gap-1 w-[118px]">
                  <div className={`${s.color} text-white rounded-full w-9 h-9 flex items-center justify-center`}>
                    <s.icon size={16} />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight text-slate-800">{s.label}</span>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">{s.sub}</span>
                </div>
                {i < pipelineSteps.length - 1 && <span className="text-gray-300 text-lg px-1">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><Bus size={12} /> Bus</label>
            <select value={selectedBus} onChange={(e) => setSelectedBus(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All buses</option>
              {buses.map((b) => (
                <option key={b.id} value={b.bus_number}>{b.bus_number}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Source: GET /buses — {buses.length} available</p>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1"><RouteIcon size={12} /> Route</label>
            <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.route_number}>{r.route_number} — {r.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">Source: GET /routes — {routes.length} available</p>
          </div>
          <div className="text-xs text-gray-500 ml-auto">
            <p>Auto-refresh every 5s</p>
            {lastRefresh && <p className="text-slate-700 font-medium">Last refresh: {lastRefresh}</p>}
          </div>
          <button onClick={fetchAll} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800">Refresh now</button>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><Video size={12} /> Camera Simulation</p>
            <p className={`mt-1 text-sm font-bold ${observations.length ? "text-emerald-600" : "text-gray-400"}`}>{observations.length ? "ACTIVE" : "IDLE"}</p>
            <p className="text-xs text-gray-500 mt-1">{observations.length} observations in DB</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><Cpu size={12} /> AI Engine</p>
            <p className={`mt-1 text-sm font-bold ${incidents.length ? "text-emerald-600" : "text-gray-400"}`}>{incidents.length ? "ACTIVE" : "IDLE"}</p>
            <p className="text-xs text-gray-500 mt-1">{incidents.length} AI incidents</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><Clock size={12} /> Last Observation</p>
            <p className="mt-1 text-sm font-medium text-slate-800 truncate">{latestObs ? new Date(latestObs.created_at || latestObs.occurred_at || "").toLocaleString() : "—"}</p>
            <p className="text-xs text-gray-500 truncate">{latestObs ? `${latestObs.bus_id} · ${latestObs.location_name || "-"}` : "No data"}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase flex items-center gap-1"><Activity size={12} /> Last Detection</p>
            <p className="mt-1 text-sm font-medium text-slate-800 truncate">{latestInc ? new Date(latestInc.created_at).toLocaleString() : "—"}</p>
            <p className="text-xs text-gray-500 truncate">{latestInc ? `${latestInc.incident_type} · ${latestInc.ai_confidence != null ? (latestInc.ai_confidence * 100).toFixed(1) + "%" : "n/a"}` : "No detection yet"}</p>
          </div>
        </div>

        {/* Main split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Simulated camera feed */}
          <div className="lg:col-span-2 bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Camera size={16} className="text-blue-600" /> SIMULATED CAMERA FEED</span>
              <div className="flex items-center gap-2">
                {hasAnnotated && (
                  <button
                    onClick={() => setShowAnnotated((v) => !v)}
                    className={`text-[11px] px-2 py-1 rounded-full border font-medium ${showingAnnotated ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-700 border-slate-300"}`}
                  >
                    {showingAnnotated ? "Showing AI annotated" : "Show AI annotated"}
                  </button>
                )}
                <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">SIMULATOR — NOT A PHYSICAL CAMERA</span>
              </div>
            </div>
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden">
              {displayImageUrl && latestObs?.image_path ? (
                <img
                  src={displayImageUrl}
                  alt={showingAnnotated ? "AI annotated frame" : "Simulated camera frame"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // fallback to raw if annotated fails, or show placeholder if raw fails
                    if (showingAnnotated && rawImageUrl) {
                      (e.currentTarget as HTMLImageElement).src = rawImageUrl;
                    } else {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }
                  }}
                />
              ) : (
                <div className="text-center p-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center"><Video size={20} className="text-slate-400" /></div>
                  <p className="text-slate-200 text-sm font-medium mt-3">No camera frame available</p>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm">Simulator sends raw frames to POST /api/bus-observations. Frames are saved under backend/local_media and served via GET /api/bus-observations/{"{id}"}/image (no Supabase).</p>
                  {latestObs && (
                    <p className="text-[11px] text-slate-500 mt-2">Latest: {latestObs.bus_id} @ {latestObs.location_name || "unknown"} · {latestObs.created_at ? new Date(latestObs.created_at).toLocaleString() : ""}</p>
                  )}
                </div>
              )}
              <div className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded flex items-center gap-1"><span className="w-2 h-2 bg-white rounded-full animate-pulse" /> REC · SIMULATED</div>
              {latestObs && <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded">{latestObs.bus_id} · {latestObs.route_id || "-"} · {latestObs.location_name || "-"}</div>}
              {showingAnnotated && latestInc && (
                <div className="absolute bottom-3 right-3 bg-purple-600/90 text-white text-xs px-2 py-1 rounded font-medium">
                  AI: {latestInc.incident_type.replace(/_/g, " ")} · {latestInc.ai_confidence != null ? (latestInc.ai_confidence * 100).toFixed(0) + "%" : ""} {latestInc.id ? `· #${latestInc.id}` : ""}
                </div>
              )}
              {showingRaw && latestObs?.local_image_url && (
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded">RAW · via {latestObs.local_image_url}</div>
              )}
            </div>
            {/* Observation details */}
            <div className="p-4 border-t bg-gray-50">
              {loading ? (
                <p className="text-sm text-gray-500">Loading observations…</p>
              ) : latestObs ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-gray-500">Bus</span><p className="font-medium text-slate-800">{latestObs.bus_id}</p></div>
                  <div><span className="text-gray-500">Route</span><p className="font-medium text-slate-800">{latestObs.route_id || "-"}</p></div>
                  <div><span className="text-gray-500">Category</span><p className="font-bold" style={{ color: getCategory(latestObs) === "pothole" ? "#dc2626" : getCategory(latestObs) === "damaged_road" ? "#ea580c" : getCategory(latestObs) === "waterlogging" ? "#0284c7" : "#64748b" }}>{formatCategory(getCategory(latestObs))}</p></div>
                  <div><span className="text-gray-500">Location</span><p className="font-medium text-slate-800 flex items-center gap-1"><MapPin size={10} />{latestObs.location_name || "-"}</p></div>
                  <div><span className="text-gray-500">GPS</span><p className="font-medium text-slate-800">{latestObs.latitude.toFixed(4)}, {latestObs.longitude.toFixed(4)}</p></div>
                  <div><span className="text-gray-500">Occurred</span><p className="font-medium text-slate-800">{latestObs.occurred_at ? new Date(latestObs.occurred_at).toLocaleString() : "-"}</p></div>
                  <div><span className="text-gray-500">Observation ID</span><p className="font-mono font-medium text-slate-800">{latestObs.id}</p></div>
                  <div><span className="text-gray-500">Image</span><p className="font-mono text-[11px] truncate text-slate-600">{latestObs.image_path || "—"}</p></div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No observations yet. Start the simulator: <code className="bg-white border px-1 rounded">python simulator/simulator.py</code></p>
              )}
            </div>
          </div>

          {/* AI processing + last detection */}
          <div className="space-y-4">
            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1"><Cpu size={12} /> AI Processing</p>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium text-emerald-700">ACTIVE · polling</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Input</span><span className="font-medium">BusObservation</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Model</span><span className="font-medium">YOLO (pothole-ai)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Output</span><span className="font-medium">Incident (source=ai)</span></div>
                <p className="text-[11px] text-gray-400 pt-2 border-t">Flow: Simulator frames → <code className="bg-gray-100 px-1 rounded">bus_observations</code> → AI worker → <code className="bg-gray-100 px-1 rounded">incidents</code> → this page.</p>
              </div>
            </div>

            <div className="bg-white border rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-700 uppercase flex items-center gap-1"><AlertTriangle size={12} /> Last AI Detection</p>
              {latestInc ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div><span className="text-gray-500">Incident ID</span><p className="font-mono font-bold text-slate-800">#{latestInc.id}</p></div>
                  <div><span className="text-gray-500">Detected type</span><p className="font-medium text-slate-800 capitalize">{latestInc.incident_type.replace(/_/g, " ")}</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-gray-500">Confidence</span><p className="font-medium">{latestInc.ai_confidence != null ? (latestInc.ai_confidence * 100).toFixed(1) + "%" : "n/a"}</p></div>
                    <div><span className="text-gray-500">Severity</span><p className="font-medium capitalize">{latestInc.severity}</p></div>
                  </div>
                  <div><span className="text-gray-500">Location</span><p className="font-medium flex items-center gap-1"><MapPin size={10} />{latestInc.location_name || "-"} · {latestInc.latitude.toFixed(4)}, {latestInc.longitude.toFixed(4)}</p></div>
                  <div><span className="text-gray-500">Bus / Route</span><p className="font-medium">{String((latestInc.metadata_json as Record<string, unknown>)?.ai_bus_id || (latestInc.metadata_json as Record<string, unknown>)?.bus_id_str || "-")} · {String((latestInc.metadata_json as Record<string, unknown>)?.ai_route_id || (latestInc.metadata_json as Record<string, unknown>)?.route_id_str || "-")}</p></div>
                  <div><span className="text-gray-500">Timestamp</span><p className="font-medium">{new Date(latestInc.created_at).toLocaleString()}</p></div>
                  {hasAnnotated && <p className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1">Annotated frame available from AI pipeline — toggle above to view bbox overlay.</p>}
                  <Link to={`/incidents/${latestInc.id}`} className="inline-block mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Open incident #{latestInc.id}</Link>
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-3">No AI incident yet. When the simulator observation is processed, detection appears here automatically.</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Camera Observations with images */}
        <div className="bg-white border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">RECENT CAMERA OBSERVATIONS</span>
            <span className="text-xs text-gray-500">Each card uses its own observation image</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {filteredObs.slice(0, 8).map((o) => {
              const url = getObsImageUrl(o);
              const cat = getCategory(o);
              return (
                <div key={o.id} className="border rounded-xl overflow-hidden bg-gray-50">
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
                    <p className="text-xs font-medium truncate">{o.bus_id} · {o.route_id || "-"}</p>
                    <p className="text-[11px] text-gray-500 truncate">{o.location_name || "-"}</p>
                    <p className="text-[10px] text-gray-400 font-mono">#{o.id} · {o.created_at ? new Date(o.created_at).toLocaleTimeString() : ""}</p>
                  </div>
                </div>
              );
            })}
            {filteredObs.length === 0 && <p className="text-xs text-gray-400 col-span-4">No observations for current filter</p>}
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Recent Observations</span>
              <span className="text-xs text-gray-500">GET /api/bus-observations</span>
            </div>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Bus</th><th className="p-2 text-left">Route</th><th className="p-2 text-left">Location</th><th className="p-2 text-left">ID</th></tr>
                </thead>
                <tbody>
                  {filteredObs.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">No observations for current filter</td></tr>
                  ) : filteredObs.map((o) => (
                    <tr key={o.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 whitespace-nowrap">{o.created_at ? new Date(o.created_at).toLocaleTimeString() : "-"}</td>
                      <td className="p-2 font-medium">{o.bus_id}</td>
                      <td className="p-2">{o.route_id || "-"}</td>
                      <td className="p-2 truncate max-w-[140px]">{o.location_name || "-"}</td>
                      <td className="p-2 font-mono">{o.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Recent AI Incidents</span>
              <span className="text-xs text-gray-500">GET /incidents?source=ai</span>
            </div>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Conf.</th><th className="p-2 text-left">Bus</th><th className="p-2 text-left">ID</th></tr>
                </thead>
                <tbody>
                  {filteredInc.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">No AI incidents for current filter</td></tr>
                  ) : filteredInc.map((inc) => {
                    const meta = inc.metadata_json as Record<string, string> | undefined;
                    const b = meta?.ai_bus_id || meta?.bus_id_str || "-";
                    return (
                      <tr key={inc.id} className="border-t hover:bg-gray-50">
                        <td className="p-2 whitespace-nowrap">{new Date(inc.created_at).toLocaleTimeString()}</td>
                        <td className="p-2 capitalize">{inc.incident_type.replace(/_/g, " ")}</td>
                        <td className="p-2">{inc.ai_confidence != null ? (inc.ai_confidence * 100).toFixed(0) + "%" : "-"}</td>
                        <td className="p-2">{String(b)}</td>
                        <td className="p-2"><Link to={`/incidents/${inc.id}`} className="text-blue-600 hover:underline font-mono">#{inc.id}</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 text-center">This page is read-only. It visualizes the existing simulator → observation → AI → incident pipeline. No image upload, no synthetic incidents, no Supabase.</p>
      </div>
    </>
  );
}
