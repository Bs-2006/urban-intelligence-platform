import { Outlet, Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import CursorAura from "../components/CursorAura";

export default function PublicLayout() {
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${isActive ? "text-blue-600" : "text-slate-600 hover:text-slate-900"} transition-colors`;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">

      {/* Ambient cursor aura — desktop only, pointer-events:none */}
      <CursorAura />

      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">UI</div>
            <span className="font-bold text-slate-900 text-[15px] tracking-tight">URBAN INTELLIGENCE</span>
            <span className="hidden sm:inline text-[10px] text-slate-500 border border-slate-200 rounded px-1.5 py-0.5">CITIZEN PORTAL</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink to="/" end className={linkCls}>Home</NavLink>
            <NavLink to="/report" className={linkCls}>Report an Issue</NavLink>
            <NavLink to="/track" className={linkCls}>Track My Complaint</NavLink>
            <a href="/#about" className="text-sm font-medium text-slate-600 hover:text-slate-900">About</a>
          </nav>
          <div className="hidden md:flex items-center">
            <Link to="/login" className="px-5 py-2 border border-slate-300 rounded-full text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Government Login
            </Link>
          </div>
          <button onClick={() => setOpen(!open)} className="md:hidden p-2 border rounded-lg">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t bg-white px-4 py-4 space-y-3">
            <NavLink to="/" end onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">Home</NavLink>
            <NavLink to="/report" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">Report an Issue</NavLink>
            <NavLink to="/track" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">Track My Complaint</NavLink>
            <a href="/#about" onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">About</a>
            <Link to="/login" onClick={() => setOpen(false)} className="block w-full text-center px-5 py-2.5 bg-slate-900 text-white rounded-full text-sm font-semibold">
              Government Login
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
        © 2026 Urban Intelligence Platform — Government Operations Center • Civic reporting for villages &amp; communities
      </footer>
    </div>
  );
}
