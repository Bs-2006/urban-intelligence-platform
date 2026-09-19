import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, AlertTriangle, Map, ClipboardList, Users,
  Bus, Route, MapPin, User, LogOut, Menu, Video, Bot,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function Sidebar({
  role,
  collapsed,
  setCollapsed,
}: {
  role?: string;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const isWorker = role === "worker";

  const workerLinks = [
    { to: "/worker",          label: "Dashboard", icon: LayoutDashboard },
    { to: "/worker/work",     label: "My Work",   icon: ClipboardList   },
    { to: "/worker/profile",  label: "My Profile", icon: User           },
  ];
  const govLinks = [
    { to: "/dashboard",    label: "Dashboard",           icon: LayoutDashboard },
    { to: "/ai-monitoring",label: "AI Camera Monitoring", icon: Video          },
    { to: "/incidents",    label: "Incidents",            icon: AlertTriangle   },
    { to: "/map",          label: "Live Map",             icon: Map             },
    { to: "/assistant",    label: "AI Assistant",         icon: Bot             },
    { to: "/work-orders",  label: "Work Orders",          icon: ClipboardList   },
  ];
  const ops = [
    { to: "/workers",    label: "Workers",    icon: Users  },
    { to: "/buses",      label: "Buses",      icon: Bus    },
    { to: "/routes",     label: "Routes",     icon: Route  },
    { to: "/bus-stands", label: "Bus Stands", icon: MapPin },
  ];

  const links = isWorker ? workerLinks : govLinks;

  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand text-white shadow-sm"
        : "text-ink-muted hover:bg-surface-subtle hover:text-ink"
    }`;

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-white border-r border-surface-border flex flex-col transition-all duration-200 shrink-0 shadow-sm`}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-surface-border shrink-0">
        {!collapsed && (
          <span className="font-bold text-sm tracking-tight text-ink">
            {isWorker ? "WORKER PORTAL" : "URBAN INTELLIGENCE"}
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 hover:bg-surface-subtle rounded-lg border border-surface-border ml-auto"
        >
          <Menu size={18} className="text-ink-muted" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-bold text-ink-subtle uppercase tracking-widest">
              {isWorker ? "My Work" : "Operations"}
            </p>
          )}
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/worker" || l.to === "/dashboard"}
              className={navItem}
            >
              <l.icon size={17} className="shrink-0" />
              {!collapsed && <span>{l.label}</span>}
            </NavLink>
          ))}
        </div>

        {!isWorker && (
          <div className="space-y-0.5">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-bold text-ink-subtle uppercase tracking-widest">
                Resources
              </p>
            )}
            {ops.map(l => (
              <NavLink key={l.to} to={l.to} className={navItem}>
                <l.icon size={17} className="shrink-0" />
                {!collapsed && <span>{l.label}</span>}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-surface-border p-2 space-y-0.5 shrink-0">
        {!isWorker && (
          <NavLink to="/profile" className={navItem}>
            <User size={17} className="shrink-0" />
            {!collapsed && <span>Profile</span>}
          </NavLink>
        )}
        <button
          onClick={() => { logout(); nav("/login"); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:bg-red-50 hover:text-red-700 transition-colors text-left"
        >
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
