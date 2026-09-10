import { useEffect, useRef } from "react";

/**
 * CursorAura
 *
 * A soft ambient light that follows the cursor on desktop.
 * - pointer-events: none — never intercepts clicks
 * - Hidden on touch devices and when prefers-reduced-motion is set
 * - Uses lerp (linear interpolation) for smooth lag movement
 * - z-index: 1 — sits above background, behind all interactive elements
 */
export default function CursorAura() {
  const auraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Don't run on touch-primary devices
    if (window.matchMedia("(hover: none)").matches) return;
    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const aura = auraRef.current;
    if (!aura) return;

    let targetX = -300;
    let targetY = -300;
    let currentX = -300;
    let currentY = -300;
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      currentX = lerp(currentX, targetX, 0.1);
      currentY = lerp(currentY, targetY, 0.1);
      if (aura) {
        aura.style.transform = `translate(${currentX - 80}px, ${currentY - 80}px)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={auraRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0.03) 50%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 1,
        willChange: "transform",
        // Start off-screen
        transform: "translate(-300px, -300px)",
      }}
    />
  );
}
