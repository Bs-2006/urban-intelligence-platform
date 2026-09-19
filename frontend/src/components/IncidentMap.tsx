import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Incident } from "../types/incident";
import { Link } from "react-router-dom";
// Fix default icon for bus stands
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png", iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", shadowUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png" });

function normalizeType(t: string): string {
  return (t || "other").toLowerCase().trim().replace(/\s+/g, "_");
}

export function getIncidentColor(rawType: string): string {
  const t = normalizeType(rawType);
  switch (t) {
    case "pothole": return "#dc2626";
    case "damaged_road":
    case "road_damage": return "#ea580c";
    case "waterlogging": return "#2563eb";
    case "garbage": return "#16a34a";
    case "streetlight":
    case "street_light": return "#9333ea";
    case "traffic_congestion": return "#eab308";
    case "pedestrian_crossing":
    case "missing_zebra": return "#06b6d4";
    case "missing_divider": return "#7f1d1d";
    case "damaged_sign": return "#92400e";
    case "unsafe_driving": return "#ec4899";
    case "hit_and_run": return "#1f2937";
    case "other":
    default: return "#6b7280";
  }
}

function createColorIcon(color: string) {
  const border = color === "#eab308" ? "#854d0e" : color === "#06b6d4" ? "#0e7490" : "white";
  return L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;background:${color};border:2px solid ${border};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

const LEGEND_ITEMS: { label: string; color: string }[] = [
  { label: "Pothole", color: "#dc2626" },
  { label: "Damaged Road", color: "#ea580c" },
  { label: "Waterlogging", color: "#2563eb" },
  { label: "Garbage", color: "#16a34a" },
  { label: "Streetlight", color: "#9333ea" },
  { label: "Traffic Congestion", color: "#eab308" },
  { label: "Pedestrian Crossing", color: "#06b6d4" },
  { label: "Missing Divider", color: "#7f1d1d" },
  { label: "Damaged Sign", color: "#92400e" },
  { label: "Unsafe Driving", color: "#ec4899" },
  { label: "Hit and Run", color: "#1f2937" },
  { label: "Other", color: "#6b7280" },
];

export const BHIMAVARAM_CENTER:[number,number] = [16.5449, 81.5212];
export default function IncidentMap({incidents, stands, height, hideLegend, publicMode, zoomControl, center: centerProp, className, hideAttribution}:{incidents:Incident[]; stands?:any[]; height?:string; hideLegend?:boolean; publicMode?:boolean; zoomControl?:boolean; center?:[number,number]; className?:string; hideAttribution?:boolean}){
  const center:[number,number]= centerProp || (incidents.length? [incidents[0].latitude, incidents[0].longitude] : [12.9716,77.5946]);
  const containerClass = height || "h-[500px]";
  return <div className={`${containerClass} rounded-xl overflow-hidden relative ${className || ""}`}>
    <MapContainer center={center} zoom={12} className="h-full w-full" scrollWheelZoom={false} zoomControl={zoomControl !== false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={hideAttribution ? "" : "&copy; OSM"}/>
      {incidents.filter(i=>i.latitude&&i.longitude).map(i=>(
        <Marker key={i.id} position={[i.latitude,i.longitude]} icon={createColorIcon(getIncidentColor(i.incident_type || (i as any).category || "other"))}>
          <Popup><div className="text-xs">
            <p className="font-bold">{i.title}</p>
            {publicMode ? <>
              <p>{i.incident_type} • {i.severity}</p>
              <p className="text-slate-500">{i.location_name}</p>
            </> : <>
              <p>{i.incident_type} • {i.severity} • {i.status}</p>
              <p>{i.source==="ai"?"AI Detected":"Citizen Report"}</p>
              <p>{i.location_name}</p>
              <Link to={`/incidents/${i.id}`} className="text-brand font-semibold">View</Link>
            </>}
          </div></Popup>
        </Marker>
      ))}
      {stands?.map((s:any)=>(
        <Marker key={s.id} position={[s.latitude,s.longitude]}>
          <Popup><b>{s.name}</b><br/>{s.code}<br/>{s.address}</Popup>
        </Marker>
      ))}
    </MapContainer>
    {!hideLegend && <div className="absolute bottom-2 right-2 z-[400] bg-white/95 backdrop-blur border border-surface-border rounded-lg shadow-md px-2.5 py-2 max-w-[160px] pointer-events-none">
      <div className="text-[10px] font-bold tracking-widest text-ink-muted mb-1.5">INCIDENT TYPES</div>
      <div className="grid grid-cols-1 gap-1">
        {LEGEND_ITEMS.map(item=>(
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0" style={{background:item.color, borderColor: item.color==="#eab308"?"#854d0e": item.color==="#06b6d4"?"#0e7490":"white"}}/>
            <span className="text-[11px] leading-none text-ink">{item.label}</span>
          </div>
        ))}
      </div>
    </div>}
  </div>;
}


