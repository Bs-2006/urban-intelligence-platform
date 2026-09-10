import { useEffect, useRef } from "react";

interface MapScanOverlayProps {
  active: boolean;
}

/**
 * MapScanOverlay
 *
 * An SVG layer absolutely positioned over the IncidentMap container.
 * - pointer-events: none — map remains fully interactive
 * - z-index: 399 — just below Leaflet panes (400) so it doesn't block popups
 * - Renders a rotating sweep arm + expanding ping rings
 * - Only activates after the boot sequence completes (active prop)
 * - Respects prefers-reduced-motion
 */
export default function MapScanOverlay({ active }: MapScanOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ping1Ref = useRef<SVGCircleElement>(null);
  const ping2Ref = useRef<SVGCircleElement>(null);
  const armRef = useRef<SVGLineElement>(null);
  const glowRef = useRef<SVGRadialGradientElement>(null);

  // Rotate the arm using rAF for smooth, non-jank rotation
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const svg = svgRef.current;
    const arm = armRef.current;
    if (!svg || !arm) return;

    let angle = 0;
    let rafId: number;

    const tick = () => {
      angle = (angle + 0.4) % 360;
      // Rotate around center of SVG (cx=50%, cy=50%) — use transform attribute
      arm.setAttribute(
        "transform",
        `rotate(${angle}, 200, 140)`
      );
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  if (!active) return null;

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 399,
        overflow: "hidden",
      }}
      viewBox="0 0 400 280"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Sweep arm gradient — fades from blue to transparent */}
        <linearGradient id="uia-arm-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(37,99,235,0)" />
          <stop offset="60%" stopColor="rgba(37,99,235,0.18)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.35)" />
        </linearGradient>

        {/* Radial fill for subtle edge glow */}
        <radialGradient id="uia-edge-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(37,99,235,0)" />
          <stop offset="75%" stopColor="rgba(37,99,235,0)" />
          <stop offset="100%" stopColor="rgba(37,99,235,0.05)" />
        </radialGradient>

        {/* Sweep cone mask */}
        <mask id="uia-sweep-mask">
          <rect width="400" height="280" fill="white" />
        </mask>
      </defs>

      {/* Subtle edge vignette — civic intelligence frame */}
      <rect
        x="0" y="0" width="400" height="280"
        fill="url(#uia-edge-glow)"
      />

      {/* Outer boundary circle — dashed civic perimeter */}
      <circle
        cx="200" cy="140" r="118"
        fill="none"
        stroke="rgba(37,99,235,0.1)"
        strokeWidth="1"
        strokeDasharray="4 8"
        style={{
          animation: "uia-map-boundary-pulse 3s ease-in-out infinite",
        }}
      />

      {/* Inner reference circle */}
      <circle
        cx="200" cy="140" r="70"
        fill="none"
        stroke="rgba(37,99,235,0.06)"
        strokeWidth="0.5"
      />

      {/* Cross hairs — very subtle */}
      <line x1="200" y1="22" x2="200" y2="258"
        stroke="rgba(37,99,235,0.05)" strokeWidth="0.5" />
      <line x1="82" y1="140" x2="318" y2="140"
        stroke="rgba(37,99,235,0.05)" strokeWidth="0.5" />

      {/* Sweep arm — rotated via rAF */}
      <line
        ref={armRef}
        x1="200" y1="140"
        x2="318" y2="140"
        stroke="url(#uia-arm-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Ping ring 1 — 0s offset */}
      <circle
        ref={ping1Ref}
        cx="200" cy="140" r="0"
        fill="none"
        stroke="rgba(37,99,235,0.3)"
        strokeWidth="1"
        style={{
          animation: "uia-radar-ping 3s cubic-bezier(0.22,1,0.36,1) infinite",
        }}
      />

      {/* Ping ring 2 — offset by 1.5s for staggered feel */}
      <circle
        ref={ping2Ref}
        cx="200" cy="140" r="0"
        fill="none"
        stroke="rgba(37,99,235,0.18)"
        strokeWidth="0.8"
        style={{
          animation: "uia-radar-ping 3s 1.5s cubic-bezier(0.22,1,0.36,1) infinite",
        }}
      />

      {/* Center pip — command center dot */}
      <circle
        cx="200" cy="140" r="3"
        fill="rgba(37,99,235,0.4)"
      />
      <circle
        cx="200" cy="140" r="1.5"
        fill="rgba(37,99,235,0.8)"
      />
    </svg>
  );
}
