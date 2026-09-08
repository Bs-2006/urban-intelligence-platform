import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";
export default function GovernmentLayout(){
  const {user}=useAuth(); const [collapsed,setCollapsed]=useState(false);
  return <div className="flex min-h-screen bg-gray-50">
    <Sidebar role={user?.role} collapsed={collapsed} setCollapsed={setCollapsed}/>
    <div className="flex-1 flex flex-col min-w-0"><Outlet/></div>
  </div>;
}
