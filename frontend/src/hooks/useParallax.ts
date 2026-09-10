import { useRef, useEffect } from "react";

/**
 * useParallax  (v3 — stable refs, perceptible values)
 *
 * Multi-layer mouse parallax.  Each layer moves at a different speed,
 * creating a convincing depth illusion.
 *
 * FIXED vs v1:
 *   - registerLayer() was called inline in JSX → created a new function
 *     every render → React null/re-registered on every render → layers
 *     never stabilised.  This version uses per-index stable useRef slots.
 *
 * TUNED vs v1:
 *   Factors are now clearly perceptible:
 *     layer(0) → 0.08  (far bg,  ~56 px movement at 1400 px screen width)
 *     layer(1) → 0.15  (mid,     ~105 px)
 *     layer(2) → 0.26  (near fg, ~182 px)
 *
 * Usage:
 *   const { sceneRef, getLayerRef } = useParallax();
 *
 *   <div ref={sceneRef}>
 *     <div ref={getLayerRef(0, 0.08)}>  far element  </div>
 *     <div ref={getLayerRef(1, 0.15)}>  mid element  </div>
 *     <div ref={getLayerRef(2, 0.26)}>  near element </div>
 *   </div>
 *
 * getLayerRef() MUST be called with a fixed index per render
 * (like React hook rules — same index every render).
 * The factor is only read once at registration time.
 */

interface LayerEntry {
  el: HTMLElement;
  factor: number;
  cx: number;   // current interpolated x offset (px)
  cy: number;   // current interpolated y offset (px)
}

export function useParallax() {
  const sceneRef = useRef<HTMLDivElement>(null);

  // Fixed-slot storage: index → LayerEntry
  // We use a plain object so indices can be sparse.
  const layerMap = useRef<Record<number, LayerEntry>>({});
  const factorMap = useRef<Record<number, number>>({});   // remembers factor per slot

  const targetRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // ── Animation loop (shared for all layers) ───────────────────
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scene = sceneRef.current;
    if (!scene) return;

    const lp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const { x: tx, y: ty } = targetRef.current;
      let allResting = true;

      for (const entry of Object.values(layerMap.current)) {
        const destX = tx * entry.factor;
        const destY = ty * entry.factor;
        entry.cx = lp(entry.cx, destX, 0.09);
        entry.cy = lp(entry.cy, destY, 0.09);
        entry.el.style.transform =
          `translate3d(${entry.cx.toFixed(2)}px, ${entry.cy.toFixed(2)}px, 0)`;

        if (
          Math.abs(entry.cx - destX) > 0.08 ||
          Math.abs(entry.cy - destY) > 0.08
        ) allResting = false;
      }

      rafRef.current = allResting ? null : requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      const rect = scene.getBoundingClientRect();
      targetRef.current = {
        x: e.clientX - (rect.left + rect.width / 2),
        y: e.clientY - (rect.top + rect.height / 2),
      };
      startLoop();
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      startLoop();
    };

    // Track mouse globally so parallax works even when cursor is outside scene
    window.addEventListener("mousemove", onMove, { passive: true });
    scene.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      scene.removeEventListener("mouseleave", onLeave);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * getLayerRef(index, factor)
   *
   * Returns a stable callback ref for the given slot index.
   * Call with the SAME index on every render (like a hook rule).
   * factor is recorded once when the element first mounts.
   */
  const getLayerRef = (index: number, factor: number) => {
    // Remember the factor for this slot
    factorMap.current[index] = factor;

    return (el: HTMLElement | null) => {
      if (el) {
        if (!layerMap.current[index]) {
          layerMap.current[index] = { el, factor, cx: 0, cy: 0 };
        } else {
          layerMap.current[index].el = el;
        }
        el.style.willChange = "transform";
      } else {
        delete layerMap.current[index];
      }
    };
  };

  return { sceneRef, getLayerRef };
}
