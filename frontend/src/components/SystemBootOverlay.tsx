import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";

/**
 * SystemBootOverlay
 *
 * A premium 7-second cinematic "system activation" experience.
 * Plays EXACTLY ONCE per browser session.
 * 
 * Sequence:
 *  0.0s - 1.5s  → Awakening (dark surface, ambient grid/glow)
 *  1.5s - 3.5s  → Identity (brand text reveal)
 *  3.5s - 5.5s  → Initialization (nodes activating, horizontal sweep)
 *  5.5s - 7.5s  → Dissolve (smooth transition to website)
 *  7.5s         → done (unmounted)
 */
export default function SystemBootOverlay() {
  const [phase, setPhase] = useState<
    "idle" | "awakening" | "identity" | "initialization" | "dissolve" | "done"
  >("idle");

  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);

  const finish = (phaseSetter: typeof setPhase) => {
    if (!completedRef.current) {
      completedRef.current = true;
      phaseSetter("done");
      sessionStorage.setItem("websiteBootShown", "1");
      // Fire event for LandingPage to start map scan
      window.dispatchEvent(new Event("uia-boot-complete"));
    }
  };

  useEffect(() => {
    // If we've already shown this during this session, skip entirely.
    if (sessionStorage.getItem("websiteBootShown")) {
      setPhase("done");
      // Still need to trigger the map scan event since we skipped the boot
      window.dispatchEvent(new Event("uia-boot-complete"));
      return;
    }

    completedRef.current = false;

    // Skip if reduced motion is preferred
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish(setPhase);
      return;
    }

    // Start sequence
    setPhase("awakening");

    const add = (fn: () => void, delay: number) => {
      const t = setTimeout(fn, delay);
      timerRefs.current.push(t);
      return t;
    };

    add(() => setPhase("identity"), 1500);
    add(() => setPhase("initialization"), 3500);
    add(() => setPhase("dissolve"), 5500);
    add(() => finish(setPhase), 7500);

    return () => {
      timerRefs.current.forEach(clearTimeout);
      timerRefs.current = [];
    };
  }, []);

  if (phase === "idle" || phase === "done") return null;

  const overlay = (
    <div
      className="uia-boot-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#020617", // Very dark slate (near black)
        animation:
          phase === "dissolve"
            ? "uia-premium-dissolve 2s cubic-bezier(0.22,1,0.36,1) forwards"
            : "none",
        pointerEvents: phase === "dissolve" ? "none" : "all",
        overflow: "hidden",
      }}
    >
      {/* Background Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(30, 41, 59, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          backgroundPosition: "center center",
          opacity: 0.4,
          animation: "uia-grid-fade 1.5s ease-out forwards",
        }}
      />

      {/* Ambient center glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "800px",
          height: "800px",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle at center, rgba(37,99,235,0.08) 0%, transparent 60%)",
          animation: "uia-premium-glow 4s ease-out forwards",
        }}
      />

      {/* Identity Phase */}
      {(phase === "identity" || phase === "initialization") && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            animation: phase === "initialization" ? "uia-fade-out-slow 1s ease-in-out forwards" : "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", animation: "uia-premium-slide-up 1s cubic-bezier(0.22,1,0.36,1) forwards" }}>
             <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "0.02em",
                boxShadow: "0 0 20px rgba(37,99,235,0.4)"
              }}
            >
              UI
            </div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "0.15em",
                margin: 0,
              }}
            >
              URBAN INTELLIGENCE
            </h1>
          </div>
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              letterSpacing: "0.25em",
              margin: 0,
              textTransform: "uppercase",
              animation: "uia-premium-slide-up 1s 0.2s cubic-bezier(0.22,1,0.36,1) forwards, uia-text-glow 3s infinite alternate",
              opacity: 0,
            }}
          >
            Civic Intelligence System
          </p>
        </div>
      )}

      {/* Initialization Phase */}
      {(phase === "initialization" || phase === "dissolve") && (
        <div style={{ position: "absolute", bottom: "35%", width: "100%", maxWidth: "600px", zIndex: 10 }}>
          {/* Signal sweep line */}
          <div style={{ position: "relative", width: "100%", height: "1px", background: "rgba(30,41,59,0.5)", overflow: "hidden" }}>
             <div
               style={{
                 position: "absolute",
                 top: 0,
                 left: 0,
                 width: "150px",
                 height: "1px",
                 background: "linear-gradient(90deg, transparent, #3b82f6, #60a5fa, transparent)",
                 animation: "uia-sweep-right 2s cubic-bezier(0.4, 0, 0.2, 1) infinite"
               }}
             />
          </div>
          
          {/* Status Nodes */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", padding: "0 20px" }}>
            {["NETWORK", "MAP", "REPORTING", "INCIDENTS", "CITIZEN"].map((label, i) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div 
                  style={{ 
                    width: "6px", 
                    height: "6px", 
                    borderRadius: "50%", 
                    background: "#3b82f6",
                    boxShadow: "0 0 10px #3b82f6",
                    opacity: 0,
                    animation: `uia-node-activate 0.5s ${i * 0.3}s forwards`
                  }} 
                />
                <span style={{ fontSize: "10px", color: "#64748b", letterSpacing: "0.1em", opacity: 0, animation: `uia-fade-in 0.5s ${i * 0.3}s forwards` }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top and Bottom cinematic bars (dissolves last) */}
      <div 
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: "40px",
          background: "linear-gradient(to bottom, rgba(2,6,23,0.8), transparent)",
          animation: phase === "dissolve" ? "uia-slide-up-out 1.5s forwards" : "none"
        }}
      />
      <div 
        style={{
          position: "absolute",
          bottom: 0, left: 0, right: 0, height: "40px",
          background: "linear-gradient(to top, rgba(2,6,23,0.8), transparent)",
          animation: phase === "dissolve" ? "uia-slide-down-out 1.5s forwards" : "none"
        }}
      />
    </div>
  );

  return createPortal(overlay, document.body);
}
