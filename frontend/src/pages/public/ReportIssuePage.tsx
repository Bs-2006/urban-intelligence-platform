import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Camera, AlertCircle, Loader2 } from "lucide-react";
import api from "../../services/api";

export default function ReportIssuePage(){
  const nav=useNavigate();
  const [form,setForm]=useState<any>({incident_type:"pothole",severity:"medium",title:"",description:"",location_name:"",address:"",latitude:"",longitude:""});
  const [file,setFile]=useState<File|null>(null);
  const [loading,setLoading]=useState(false); 
  const [gettingLocation, setGettingLocation]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  
  const upd=(k:string,v:any)=> setForm((p:any)=>({...p,[k]:v}));
  
  const geo=()=> {
    setGettingLocation(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      p=>{ 
        upd("latitude",p.coords.latitude); 
        upd("longitude",p.coords.longitude); 
        setGettingLocation(false);
      }, 
      ()=> {
        setErr("Geolocation permission denied. Please enable location access or enter coordinates manually.");
        setGettingLocation(false);
      }
    );
  };
  
  const submit=async(e:any)=>{
    e.preventDefault(); setLoading(true); setErr(null);
    try{
      const fd=new FormData();
      fd.append("incident_type", form.incident_type);
      fd.append("severity", form.severity);
      fd.append("title", form.title);
      if(form.description) fd.append("description", form.description);
      if(form.location_name) fd.append("location_name", form.location_name);
      if(form.address) fd.append("address", form.address);
      fd.append("latitude", String(form.latitude));
      fd.append("longitude", String(form.longitude));
      if(file) fd.append("file", file);
      const r=await api.post("/public/incidents", fd, { headers: { "Content-Type":"multipart/form-data"}});
      const created=r.data;
      nav("/report-success", { state: created });
    }catch(ex:any){ 
      setErr(ex.response?.data?.detail || ex.message || "Failed to submit report. Please try again."); 
    } finally{ 
      setLoading(false); 
    }
  };

  const issueTypes = [
    { value: "pothole", label: "Pothole" },
    { value: "damaged_road", label: "Damaged Road" },
    { value: "waterlogging", label: "Waterlogging" },
    { value: "garbage", label: "Garbage" },
    { value: "streetlight", label: "Streetlight Issue" },
    { value: "missing_divider", label: "Missing Divider" },
    { value: "missing_zebra", label: "Missing Zebra Crossing" },
    { value: "damaged_sign", label: "Damaged Sign" },
    { value: "other", label: "Other" },
  ];

  return <div className="max-w-3xl mx-auto px-6 py-10">
    <div className="mb-8">
      <Link to="/" className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4">
        â† Back to Home
      </Link>
      <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Report a Civic Issue</h1>
      <p className="text-slate-600">Help improve your village by reporting problems. Required fields are marked with *</p>
    </div>

    <form onSubmit={submit} className="bg-white border-2 border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
      {/* Issue Type */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Issue Type <span className="text-red-600">*</span>
        </label>
        <select 
          required
          value={form.incident_type} 
          onChange={e=>upd("incident_type",e.target.value)} 
          className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
        >
          {issueTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Title <span className="text-red-600">*</span>
        </label>
        <input 
          required 
          placeholder="Brief description (e.g., Large pothole on Main Street)" 
          value={form.title} 
          onChange={e=>upd("title",e.target.value)} 
          className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Description
        </label>
        <textarea 
          placeholder="Provide more details about the issue..." 
          value={form.description} 
          onChange={e=>upd("description",e.target.value)} 
          rows={4}
          className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Location Section */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-blue-900 font-semibold mb-2">
          <MapPin size={20} />
          <span>Location Information</span>
        </div>

        {/* 📍 Use My Location Button */}
        <button 
          type="button" 
          onClick={geo}
          disabled={gettingLocation}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:bg-blue-400"
        >
          {gettingLocation ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Getting Location...
            </>
          ) : (
            <>
              <MapPin size={20} />
              📍 Use My Location
            </>
          )}
        </button>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Latitude <span className="text-red-600">*</span>
            </label>
            <input 
              required 
              type="number" 
              step="any" 
              placeholder="e.g., 17.3850" 
              value={form.latitude} 
              onChange={e=>upd("latitude",e.target.value)} 
              className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Longitude <span className="text-red-600">*</span>
            </label>
            <input 
              required 
              type="number" 
              step="any" 
              placeholder="e.g., 78.4867" 
              value={form.longitude} 
              onChange={e=>upd("longitude",e.target.value)} 
              className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Village/Location Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Village/Location Name
          </label>
          <input 
            placeholder="e.g., Gandhi Nagar" 
            value={form.location_name} 
            onChange={e=>upd("location_name",e.target.value)} 
            className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Address/Landmark */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Address/Landmark
          </label>
          <input 
            placeholder="e.g., Near Community Center, Main Road" 
            value={form.address} 
            onChange={e=>upd("address",e.target.value)} 
            className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Upload Photo */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Camera size={18} />
          📷 Upload Photo
        </label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={e=>setFile(e.target.files?.[0]||null)} 
          className="w-full border-2 border-slate-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            âœ“ Photo selected: {file.name}
          </p>
        )}
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-2">
          Severity
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["low","medium","high","critical"].map(s=>(
            <label key={s} className="relative">
              <input 
                type="radio" 
                name="severity" 
                value={s} 
                checked={form.severity===s}
                onChange={e=>upd("severity",e.target.value)}
                className="peer sr-only"
              />
              <div className="border-2 border-slate-300 rounded-lg px-4 py-3 text-center cursor-pointer peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-900 font-medium capitalize hover:border-slate-400 transition-colors">
                {s}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {err&&(
        <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <span className="text-sm">{err}</span>
        </div>
      )}

      {/* Submit Button */}
      <button 
        type="submit"
        disabled={loading} 
        className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Submitting Report...
          </>
        ) : (
          "Submit Report"
        )}
      </button>
    </form>
  </div>;
}

