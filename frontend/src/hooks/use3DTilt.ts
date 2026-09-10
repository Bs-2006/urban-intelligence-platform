import { useRef, useEffect } from "react";

/**
 * use3DTilt  (v3 — direct DOM attachment)
 *
 * Attaches mousemove/mouseleave directly to the element via useEffect.
 * Caller only assigns the ref — NO JSX event props required.
 *
 * Why direct attachment:
 *   - Avoids React synthetic-event batching delays
 *   - Eliminates the need for the caller to wire onMouseMove/onMouseLeave
 *   - Cannot accidentally be forgotten when re-rendering the consumer
 *
 * Visible values (not subtle):
 *   maxDeg   8   — clearly perceptible tilt at card edges
 *   liftZ    24  — card visually pops 24 px toward viewer
 *   lerp     0.22 — snappy enough to track the cursor in real time
 *   shadow transitions from flat → deep to reinforce the lift
 *
 * Shimmer is written directly as a background style on the child
 * .tilt-shimmer element — NO CSS vars, NO class toggling required.
 *
 * Usage:
 *   const ref = use3DTilt();          // defaults
 *   const ref = use3DTilt({ maxDeg: 5, liftZ: 16 });
 *   <div ref={ref}>...</div>
 */

export interface TiltOptions {
  maxDeg?: number;
  perspective?: number;
  liftZ?: number;
  lerp?: number;
}

export function use3DTilt<T extends HTMLElement = HTMLDivElement>(
  opts: TiltOptions = {}
) {
  const {
    maxDeg = 8,
    perspective = 800,
    liftZ = 24,
    lerp: lerpFactor = 0.22,
  } = opts;

  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Hard-disable for users who prefer reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // ── rAF state ─────────────────────────────────────────────
    let raf: number | null = null;
    const tgt = { rx: 0, ry: 0, lz: 0, active: false };
    const cur = { rx: 0, ry: 0, lz: 0 };

    // ── Shimmer child — written via JS, no CSS vars ────────────
    // We look for the first child with class "tilt-shimmer".
    // If none exists we inject one so the hook is self-contained.
    let shimmer = el.querySelector<HTMLElement>(".tilt-shimmer");
    let injected = false;
    if (!shimmer) {
      shimmer = document.createElement("div");
      shimmer.className = "tilt-shimmer";
      shimmer.setAttribute("aria-hidden", "true");
      Object.assign(shimmer.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: "10",
        opacity: "0",
        transition: "opacity 0.18s ease",
      });
      el.appendChild(shimmer);
      injected = true;
    }

    // ── Ensure the host element has position:relative so shimmer works ──
    const hostPos = window.getComputedStyle(el).position;
    if (hostPos === "static") el.style.position = "relative";

    // Remove any CSS transition that fights the JS transform loop
    el.style.transition = "box-shadow 0.35s ease";
    el.style.willChange = "transform";

    // ── Lerp helper ────────────────────────────────────────────
    const lp = (a: number, b: number, t: number) => a + (b - a) * t;

    // ── Animation loop ─────────────────────────────────────────
    const tick = () => {
      cur.rx = lp(cur.rx, tgt.active ? tgt.rx : 0, lerpFactor);
      cur.ry = lp(cur.ry, tgt.active ? tgt.ry : 0, lerpFactor);
      cur.lz = lp(cur.lz, tgt.active ? liftZ : 0, lerpFactor);

      el.style.transform =
        `perspective(${perspective}px) ` +
        `rotateX(${cur.rx.toFixed(3)}deg) ` +
        `rotateY(${cur.ry.toFixed(3)}deg) ` +
        `translateZ(${cur.lz.toFixed(2)}px)`;

      el.style.boxShadow = tgt.active
        ? `0 24px 56px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.12)`
        : `0 4px 16px rgba(0,0,0,0.08)`;

      const atRest =
        !tgt.active &&
        Math.abs(cur.rx) < 0.04 &&
        Math.abs(cur.ry) < 0.04 &&
        Math.abs(cur.lz) < 0.2;

      if (atRest) {
        cur.rx = 0; cur.ry = 0; cur.lz = 0;
        el.style.transform =
          `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) translateZ(0px)`;
        el.style.boxShadow = `0 4px 16px rgba(0,0,0,0.08)`;
        if (shimmer) shimmer.style.opacity = "0";
        raf = null;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    const startLoop = () => {
      if (raf === null) raf = requestAnimationFrame(tick);
    };

    // ── Event handlers ─────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      // Normalise cursor position to –1 … +1 within the element
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      tgt.rx = -ny * maxDeg;   // top edge tilts toward viewer when cursor is low
      tgt.ry = nx * maxDeg;   // right edge tilts toward viewer when cursor is right
      tgt.active = true;

      // Update shimmer radial gradient centre (JS direct — no CSS vars)
      if (shimmer) {
        const sx = ((e.clientX - rect.left) / rect.width) * 100;
        const sy = ((e.clientY - rect.top) / rect.height) * 100;
        shimmer.style.background =
          `radial-gradient(circle at ${sx.toFixed(1)}% ${sy.toFixed(1)}%, ` +
          `rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 50%, transparent 75%)`;
        shimmer.style.opacity = "1";
      }

      startLoop();
    };

    const onLeave = () => {
      tgt.active = false;
      startLoop(); // let the lerp spring back to zero
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      // Reset element styles on unmount
      el.style.transform = "";
      el.style.boxShadow = "";
      el.style.willChange = "";
      el.style.transition = "";
      if (injected && shimmer && el.contains(shimmer)) el.removeChild(shimmer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDeg, perspective, liftZ, lerpFactor]);

  return ref;
}
