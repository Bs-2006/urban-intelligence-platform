import { Outlet, Link, NavLink } from "react-router-dom";
import { Menu, X, Leaf } from "lucide-react";
import { useState } from "react";

export default function PublicLayout() {
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive ? "text-brand font-semibold" : "text-ink-muted hover:text-ink"
    }`;

  return (
    <div className="min-h-screen bg-surface-page flex flex-col">
      {/* ── Header ── */}
      <header className="bg-white border-b border-surface-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <Leaf size={16} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-ink text-[14px] tracking-tight">Urban Intelligence</span>
              <span className="text-[10px] text-ink-subtle font-medium tracking-wide hidden sm:block">
                Civic Technology Platform
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            <NavLink to="/" end className={linkCls}>Home</NavLink>
            <NavLink to="/report" className={linkCls}>Report an Issue</NavLink>
            <NavLink to="/track" className={linkCls}>Track Complaint</NavLink>
            <a href="/#about" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">
              About
            </a>
          </nav>

          {/* Government Login CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-5 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors shadow-sm"
            >
              Government Login
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 border border-surface-border rounded-lg text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden border-t border-surface-border bg-white px-4 py-4 space-y-1">
            <NavLink to="/" end onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-ink rounded-lg hover:bg-surface-subtle">Home</NavLink>
            <NavLink to="/report" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-ink rounded-lg hover:bg-surface-subtle">Report an Issue</NavLink>
            <NavLink to="/track" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-ink rounded-lg hover:bg-surface-subtle">Track Complaint</NavLink>
            <a href="/#about" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm font-medium text-ink rounded-lg hover:bg-surface-subtle">About</a>
            <div className="pt-2 border-t border-surface-border">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="block w-full text-center px-5 py-2.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors"
              >
                Government Login
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
                  <Leaf size={14} className="text-white" />
                </div>
                <span className="font-bold text-sm tracking-tight">Urban Intelligence</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                A smart civic-technology platform for transparent, responsive municipal governance.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Citizens</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><Link to="/report" className="hover:text-white transition-colors">Report an Issue</Link></li>
                <li><Link to="/track" className="hover:text-white transition-colors">Track Complaint</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Government</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><Link to="/login" className="hover:text-white transition-colors">Government Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-gray-500">
            © 2026 Urban Intelligence Platform — Government Operations Center
          </div>
        </div>
      </footer>
    </div>
  );
}
