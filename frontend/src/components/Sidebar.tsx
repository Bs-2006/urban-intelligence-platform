import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, AlertTriangle, Map, ClipboardList, Users, Bus, Route, MapPin, User, LogOut, Menu, Briefcase, Video, Bot } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
export default function Sidebar({role, collapsed, setCollapsed}:{role?:string; collapsed:boolean; setCollapsed:(v:boolean)=>void}){
  const {logout}=useAuth(); const nav=useNavigate();
  const govLinks=[
    {to:"/dashboard", label:"Dashboard", icon:LayoutDashboard},
    {to:"/ai-monitoring", label:"AI Camera Monitoring", icon:Video},
    {to:"/incidents", label:"Incidents", icon:AlertTriangle},
    {to:"/map", label:"Live Map", icon:Map},
    {to:"/assistant", label:"AI Assistant", icon:Bot},
    {to:"/work-orders", label:"Work Orders", icon:ClipboardList},
  ];
  const ops=[
    {to:"/workers", label:"Workers", icon:Users},
    {to:"/buses", label:"Buses", icon:Bus},
    {to:"/routes", label:"Routes", icon:Route},
    {to:"/bus-stands", label:"Bus Stands", icon:MapPin},
  ];
  const workerLinks=[
    {to:"/worker", label:"My Dashboard", icon:LayoutDashboard},
    {to:"/worker/work", label:"My Work", icon:Briefcase},
  ];
  const isWorker=role==="worker";
  return (
    <aside className={`${collapsed?"w-16":"w-64"} bg-white border-r border-slate-200 text-slate-700 flex flex-col transition-all duration-200 shrink-0`}>
      <div className="h-14 flex items-center justify-between px-3 border-b border-slate-200 bg-white">
        {!collapsed && <span className="font-bold text-sm tracking-tight text-slate-900">URBAN INTELLIGENCE</span>}
        <button onClick={()=>setCollapsed(!collapsed)} className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200"><Menu size={18} className="text-slate-600"/></button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4 bg-white">
        <div className="space-y-1">
          {!collapsed && <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">{isWorker?"Work":"Operations"}</p>}
          {(isWorker?workerLinks:govLinks).map(l=>(
            <NavLink key={l.to} to={l.to} className={({isActive})=>`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><l.icon size={18}/>{!collapsed&&l.label}</NavLink>
          ))}
        </div>
        {!isWorker && <div className="space-y-1">
          {!collapsed && <p className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Resources</p>}
          {ops.map(l=>(
            <NavLink key={l.to} to={l.to} className={({isActive})=>`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${isActive?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><l.icon size={18}/>{!collapsed&&l.label}</NavLink>
          ))}
        </div>}
      </nav>
      <div className="border-t border-slate-200 p-2 space-y-1 bg-white">
        <NavLink to="/profile" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"><User size={18}/>{!collapsed&&"Profile"}</NavLink>
        <button onClick={()=>{logout(); nav("/login");}} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-left"><LogOut size={18}/>{!collapsed&&"Logout"}</button>
      </div>
    </aside>
  );
}
