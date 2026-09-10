import { useEffect, useRef } from "react";

/**
 * CivicMapPanel
 *
 * Dark "Civic Location Intelligence" decorative panel for the
 * Government Login page. Purely visual — no APIs, no real map data.
 *
 * Contents:
 *  - Dark charcoal background with subtle grid
 *  - Abstract road-line geometry
 *  - A few location nodes with pulse rings
 *  - One primary location marker (animated drop)
 *  - Slow rotating radar sweep (SVG + rAF)
 *  - Expanding radar ping rings (CSS animation)
 *  - Coordinate / status labels
 *  - Soft parallax depth on mouse move (uses existing useParallax pattern)
 *
 * Design constraints:
 *  - Respects prefers-reduced-motion (radar spin and parallax disabled)
 *  - All animations are slow and restrained — never distracting
 *  - Uses only existing project accent colors (blue-600, indigo, slate)
 *  - Self-contained: no external deps beyond React
 */

export default function CivicMapPanel() {
  const radarArmRef  = useRef<SVGLineElement>(null);
  const panelRef     = useRef<HTMLDivElement>(null);

  // ── Radar sweep — rAF rotation ──────────────────────────────
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const arm = radarArmRef.current;
    if (!arm) return;

    let angle = 0;
    let raf: number;

    const tick = () => {
      angle = (angle + 0.25) % 360;          // 0.25°/frame ≈ one full rotation every ~24s
      arm.setAttribute("transform", `rotate(${angle}, 200, 200)`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Subtle mouse parallax on the panel layers ────────────────
  const deepRef  = useRef<HTMLDivElement>(null);   // factor 0.012 — barely moves
  const midRef   = useRef<HTMLDivElement>(null);   // factor 0.025
  const nearRef  = useRef<HTMLDivElement>(null);   // factor 0.045

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const panel = panelRef.current;
    if (!panel) return;

    const layers = [
      { el: deepRef.current,  factor: 0.012 },
      { el: midRef.current,   factor: 0.025 },
      { el: nearRef.current,  factor: 0.045 },
    ];

    let raf: number | null = null;
    const tgt = { x: 0, y: 0 };
    const cur = layers.map(() => ({ x: 0, y: 0 }));
    const lp  = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      let moving = false;
      layers.forEach(({ el, factor }, i) => {
        if (!el) return;
        cur[i].x = lp(cur[i].x, tgt.x * factor, 0.07);
        cur[i].y = lp(cur[i].y, tgt.y * factor, 0.07);
        el.style.transform = `translate3d(${cur[i].x.toFixed(2)}px,${cur[i].y.toFixed(2)}px,0)`;
        if (Math.abs(cur[i].x - tgt.x * factor) > 0.05) moving = true;
      });
      raf = moving ? requestAnimationFrame(tick) : null;
    };
    const start = () => { if (raf === null) raf = requestAnimationFrame(tick); };

    const onMove = (e: MouseEvent) => {
      const r = panel.getBoundingClientRect();
      tgt.x = e.clientX - (r.left + r.width  / 2);
      tgt.y = e.clientY - (r.top  + r.height / 2);
      start();
    };
    const onLeave = () => { tgt.x = 0; tgt.y = 0; start(); };

    window.addEventListener("mousemove",  onMove,  { passive: true });
    panel.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      panel.removeEventListener("mouseleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      aria-hidden="true"
      style={{
        position: "relative",
        width:  "100%",
        height: "100%",
        minHeight: 480,
        borderRadius: 20,
        overflow: "hidden",
        background: "linear-gradient(145deg, #0d1117 0%, #111827 55%, #0f172a 100%)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >

      {/* ── Grid layer (far — barely moves) ──────────────────── */}
      <div
        ref={deepRef}
        style={{
          position: "absolute", inset: -20,
          willChange: "transform",
          backgroundImage:
            "linear-gradient(rgba(37,99,235,0.07) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(37,99,235,0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* ── Road geometry + nodes layer (mid depth) ──────────── */}
      <div
        ref={midRef}
        style={{ position: "absolute", inset: 0, willChange: "transform" }}
      >
        <svg
          viewBox="0 0 400 480"
          preserveAspectRatio="xMidYMid slice"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          <defs>
            {/* Radar sweep gradient */}
            <linearGradient id="cmp-sweep" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgba(37,99,235,0)"    />
              <stop offset="65%"  stopColor="rgba(37,99,235,0.22)" />
              <stop offset="100%" stopColor="rgba(37,99,235,0.45)" />
            </linearGradient>

            {/* Glow filter for nodes */}
            <filter id="cmp-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Soft radial gradient overlay */}
            <radialGradient id="cmp-radial" cx="50%" cy="42%" r="52%">
              <stop offset="0%"   stopColor="rgba(37,99,235,0.08)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)"        />
            </radialGradient>
          </defs>

          {/* Soft centre glow */}
          <ellipse cx="200" cy="200" rx="190" ry="190"
            fill="url(#cmp-radial)" />

          {/* ── Abstract road lines ──────────────────────────── */}
          {/* Horizontal arterial */}
          <line x1="0"   y1="195" x2="400" y2="195"
            stroke="rgba(37,99,235,0.12)" strokeWidth="1" />
          {/* Vertical arterial */}
          <line x1="200" y1="0"   x2="200" y2="480"
            stroke="rgba(37,99,235,0.12)" strokeWidth="1" />
          {/* Diagonal roads */}
          <line x1="40"  y1="40"  x2="200" y2="195"
            stroke="rgba(37,99,235,0.09)" strokeWidth="0.8" />
          <line x1="360" y1="40"  x2="200" y2="195"
            stroke="rgba(37,99,235,0.09)" strokeWidth="0.8" />
          <line x1="60"  y1="400" x2="200" y2="195"
            stroke="rgba(37,99,235,0.07)" strokeWidth="0.7" />
          <line x1="340" y1="400" x2="200" y2="195"
            stroke="rgba(37,99,235,0.07)" strokeWidth="0.7" />
          {/* Ring roads */}
          <circle cx="200" cy="195" r="80"
            fill="none" stroke="rgba(37,99,235,0.08)" strokeWidth="0.7"
            strokeDasharray="4 8" />
          <circle cx="200" cy="195" r="140"
            fill="none" stroke="rgba(37,99,235,0.06)" strokeWidth="0.7"
            strokeDasharray="3 10" />

          {/* ── Radar circles ────────────────────────────────── */}
          <circle cx="200" cy="200" r="60"
            fill="none" stroke="rgba(37,99,235,0.10)" strokeWidth="0.8" />
          <circle cx="200" cy="200" r="110"
            fill="none" stroke="rgba(37,99,235,0.07)" strokeWidth="0.7" />
          <circle cx="200" cy="200" r="160"
            fill="none" stroke="rgba(37,99,235,0.05)" strokeWidth="0.6" />

          {/* Cross-hairs */}
          <line x1="200" y1="60"  x2="200" y2="340"
            stroke="rgba(37,99,235,0.06)" strokeWidth="0.5" />
          <line x1="60"  y1="200" x2="340" y2="200"
            stroke="rgba(37,99,235,0.06)" strokeWidth="0.5" />

          {/* ── Radar sweep arm (rAF driven) ─────────────────── */}
          <line
            ref={radarArmRef}
            x1="200" y1="200" x2="360" y2="200"
            stroke="url(#cmp-sweep)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* ── Ping rings ───────────────────────────────────── */}
          <circle cx="200" cy="200" r="0" fill="none"
            stroke="rgba(37,99,235,0.35)" strokeWidth="1"
            style={{ animation: "cmp-ping 4s cubic-bezier(0.22,1,0.36,1) infinite" }} />
          <circle cx="200" cy="200" r="0" fill="none"
            stroke="rgba(37,99,235,0.20)" strokeWidth="0.8"
            style={{ animation: "cmp-ping 4s 2s cubic-bezier(0.22,1,0.36,1) infinite" }} />

          {/* ── Secondary location nodes ─────────────────────── */}
          {/* Node A */}
          <circle cx="120" cy="130" r="3.5" fill="rgba(37,99,235,0.6)"
            filter="url(#cmp-glow)" />
          <circle cx="120" cy="130" r="7" fill="none"
            stroke="rgba(37,99,235,0.25)" strokeWidth="0.8"
            style={{ animation: "cmp-node-pulse 3s 0.5s ease-in-out infinite" }} />

          {/* Node B */}
          <circle cx="298" cy="150" r="3" fill="rgba(99,102,241,0.7)"
            filter="url(#cmp-glow)" />
          <circle cx="298" cy="150" r="6" fill="none"
            stroke="rgba(99,102,241,0.22)" strokeWidth="0.7"
            style={{ animation: "cmp-node-pulse 3.5s 1s ease-in-out infinite" }} />

          {/* Node C */}
          <circle cx="155" cy="290" r="2.5" fill="rgba(37,99,235,0.5)"
            filter="url(#cmp-glow)" />
          <circle cx="155" cy="290" r="5" fill="none"
            stroke="rgba(37,99,235,0.20)" strokeWidth="0.7"
            style={{ animation: "cmp-node-pulse 4s 1.8s ease-in-out infinite" }} />

          {/* Node D */}
          <circle cx="265" cy="300" r="2.5" fill="rgba(148,163,184,0.4)" />

          {/* ── Primary location marker (centre) ─────────────── */}
          {/* Outer glow ring */}
          <circle cx="200" cy="195" r="12" fill="rgba(37,99,235,0.10)" />
          {/* Marker body — teardrop via two circles + line */}
          <circle cx="200" cy="190" r="6"
            fill="rgba(37,99,235,0.90)"
            filter="url(#cmp-glow)"
            style={{ animation: "cmp-marker-bob 4s ease-in-out infinite" }} />
          <circle cx="200" cy="190" r="3"
            fill="rgba(255,255,255,0.85)"
            style={{ animation: "cmp-marker-bob 4s ease-in-out infinite" }} />
          {/* Marker drop shadow pin */}
          <ellipse cx="200" cy="203" rx="4" ry="1.5"
            fill="rgba(0,0,0,0.35)"
            style={{ animation: "cmp-pin-shadow 4s ease-in-out infinite" }} />
        </svg>
      </div>

      {/* ── Near layer: labels + status chips ────────────────── */}
      <div
        ref={nearRef}
        style={{ position: "absolute", inset: 0, willChange: "transform" }}
      >
        {/* Top-left — coordinates */}
        <div style={{
          position: "absolute", top: 20, left: 20,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 9,
          color: "rgba(148,163,184,0.55)",
          letterSpacing: "0.08em",
          lineHeight: 1.7,
        }}>
          <div>16.5449° N</div>
          <div>81.5212° E</div>
        </div>

        {/* Top-right — system label */}
        <div style={{
          position: "absolute", top: 20, right: 20,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px rgba(34,197,94,0.6)",
            animation: "cmp-dot-blink 2s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "monospace", fontSize: 9,
            color: "rgba(148,163,184,0.55)",
            letterSpacing: "0.10em",
          }}>CIVIC GRID ONLINE</span>
        </div>

        {/* Bottom-left — zone label */}
        <div style={{
          position: "absolute", bottom: 56, left: 20,
          background: "rgba(37,99,235,0.12)",
          border: "1px solid rgba(37,99,235,0.20)",
          borderRadius: 6, padding: "3px 8px",
          fontFamily: "monospace", fontSize: 9,
          color: "rgba(147,197,253,0.75)",
          letterSpacing: "0.10em",
        }}>
          URBAN ZONE — IV
        </div>

        {/* Bottom — node count */}
        <div style={{
          position: "absolute", bottom: 56, right: 20,
          fontFamily: "monospace", fontSize: 9,
          color: "rgba(148,163,184,0.45)",
          letterSpacing: "0.08em",
          textAlign: "right",
          lineHeight: 1.7,
        }}>
          <div>NODES  4 / ACTIVE</div>
          <div>SIGNAL ▪▪▪▪░ 82%</div>
        </div>

        {/* Floating node label near Node A */}
        <div style={{
          position: "absolute",
          top: "calc(130px / 480px * 100% - 28px)",
          left: "calc(120px / 400px * 100% + 14px)",
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(147,197,253,0.50)",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}>
          NODE-01
        </div>

        {/* Floating node label near Node B */}
        <div style={{
          position: "absolute",
          top: "calc(150px / 480px * 100% - 24px)",
          left: "calc(298px / 400px * 100% + 8px)",
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(165,180,252,0.45)",
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}>
          NODE-02
        </div>

        {/* Centre label below primary marker */}
        <div style={{
          position: "absolute",
          top: "calc(210px / 480px * 100%)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(147,197,253,0.60)",
          letterSpacing: "0.12em",
          whiteSpace: "nowrap",
        }}>
          HQ — OPERATIONS CENTER
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 44,
        background: "linear-gradient(to top, rgba(13,17,23,0.95), transparent)",
        display: "flex", alignItems: "flex-end",
        padding: "0 20px 12px",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(100,116,139,0.55)",
          letterSpacing: "0.10em",
        }}>
          URBAN INTELLIGENCE — CIVIC LOCATION GRID
        </span>
        <span style={{
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(100,116,139,0.45)",
          letterSpacing: "0.08em",
        }}>
          v2.4.1
        </span>
      </div>

      {/* ── Vignette corners ──────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none",
        background:
          "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.35) 100%)",
      }} />

      {/* Subtle inner border glow */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none",
        boxShadow: "inset 0 0 0 1px rgba(37,99,235,0.12), inset 0 0 40px rgba(37,99,235,0.04)",
      }} />
    </div>
  );
}
