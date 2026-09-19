import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

export default function GovernmentLayout() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-subtle">
      {/* Fixed sidebar */}
      <Sidebar role={user?.role} collapsed={collapsed} setCollapsed={setCollapsed} />
      {/* Scrollable content column — Topbar is sticky inside here */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
