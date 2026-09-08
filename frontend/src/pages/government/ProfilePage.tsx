import { useEffect, useState } from "react";
import Topbar from "../../components/Topbar";
import { fetchMe, updateMe } from "../../services/authService";
export default function ProfilePage(){
  const [me,setMe]=useState<any>(null); const [name,setName]=useState(""); const [msg,setMsg]=useState("");
  useEffect(()=>{ fetchMe().then(d=>{ setMe(d); setName(d.full_name||""); }); },[]);
  const save=async()=>{ try{ await updateMe({full_name:name}); setMsg("Saved"); }catch(e:any){ setMsg(e.message); } };
  return <><Topbar title="Profile"/><div className="p-6 max-w-lg"><div className="bg-white border rounded-xl p-6 space-y-3"><p className="text-sm text-gray-500">{me?.email} • {me?.role}</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className="w-full border rounded px-3 py-2"/><button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded">Save</button>{msg&&<p className="text-sm text-green-600">{msg}</p>}</div></div></>;
}
