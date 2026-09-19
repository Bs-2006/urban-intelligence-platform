import { useEffect, useState } from "react";

interface Props {
  onComplete: () => void;
}

// Cinematic intro splash screen — dark government/civic technology style.
// Total duration ~4.5s. Respects prefers-reduced-motion.
export default function IntroSplash({ onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  // phase 0 = black hold
  // phase 1 = logo icon fades in
  // phase 2 = "URBAN INTELLIGENCE" fades in
  // phase 3 = "CIVIC INTELLIGENCE SYSTEM" fades in
  // phase 4 = progress line + nav labels appear
  // phase 5 = whole screen fades out → onComplete

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) {
      // Skip straight to completion after a brief hold
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }

    const timings = [
      { delay: 700,  next: 1 },   // 0.7s → show icon
      { delay: 800,  next: 2 },   // +0.8s → show title
      { delay: 700,  next: 3 },   // +0.7s → show subtitle
      { delay: 700,  next: 4 },   // +0.7s → show indicators
      { delay: 1000, next: 5 },   // +1.0s → fade out
    ];

    let cumulativeDelay = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    timings.forEach(({ delay, next }) => {
      cumulativeDelay += delay;
      const t = setTimeout(() => setPhase(next), cumulativeDelay);
      timers.push(t);
    });

    // After fade-out animation (400ms) call onComplete
    const completeTimer = setTimeout(onComplete, cumulativeDelay + 400);
    timers.push(completeTimer);

    return () => timers.forEach(clearTimeout);
  }, []);

  const navLabels = ["NETWORK", "MAP", "REPORTING", "OPERATIONS"];

  return (
    <>
      <style>{`
        @keyframes ui-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ui-fade-in-still {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ui-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes ui-screen-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }

        .ui-intro-icon    { animation: ui-fade-in-still 0.6s ease forwards; }
        .ui-intro-title   { animation: ui-fade-in 0.6s ease forwards; }
        .ui-intro-sub     { animation: ui-fade-in 0.5s ease forwards; }
        .ui-intro-bar     { animation: ui-progress 0.9s ease forwards; }
        .ui-intro-nav     { animation: ui-fade-in 0.5s ease forwards; }
        .ui-intro-fadeout { animation: ui-screen-out 0.4s ease forwards; }

        .ui-nav-item-1 { animation-delay: 0.05s; }
        .ui-nav-item-2 { animation-delay: 0.15s; }
        .ui-nav-item-3 { animation-delay: 0.25s; }
        .ui-nav-item-4 { animation-delay: 0.35s; }
      `}</style>

      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none${phase === 5 ? " ui-intro-fadeout" : ""}`}
        style={{ backgroundColor: "#000000" }}
        aria-hidden="true"
      >
        {/* Skip button */}
        <button
          onClick={onComplete}
          style={{
            position: "absolute",
            top: "1.25rem",
            right: "1.5rem",
            fontSize: "0.65rem",
            letterSpacing: "0.15em",
            color: "#6B6B6B",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "0.5rem 0.75rem",
            opacity: phase >= 2 ? 1 : 0,
            transition: "opacity 0.4s ease, color 0.2s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#D6D4CF")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6B6B6B")}
        >
          SKIP
        </button>

        {/* Centre content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0",
            width: "100%",
            maxWidth: "480px",
            padding: "0 2rem",
          }}
        >
          {/* Logo mark */}
          {phase >= 1 && (
            <div
              className="ui-intro-icon"
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "12px",
                backgroundColor: "#F2F1ED",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.25rem",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  letterSpacing: "0.05em",
                  color: "#0B0B0B",
                }}
              >
                UI
              </span>
            </div>
          )}

          {/* URBAN INTELLIGENCE */}
          {phase >= 2 && (
            <h1
              className="ui-intro-title"
              style={{
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                fontWeight: 800,
                fontSize: "clamp(1.4rem, 5vw, 2rem)",
                letterSpacing: "0.18em",
                color: "#F2F1ED",
                margin: 0,
                textAlign: "center",
                lineHeight: 1.1,
              }}
            >
              URBAN INTELLIGENCE
            </h1>
          )}

          {/* CIVIC INTELLIGENCE SYSTEM */}
          {phase >= 3 && (
            <p
              className="ui-intro-sub"
              style={{
                fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                fontWeight: 400,
                fontSize: "clamp(0.6rem, 2vw, 0.7rem)",
                letterSpacing: "0.28em",
                color: "#8A8A8A",
                margin: "0.6rem 0 0 0",
                textAlign: "center",
              }}
            >
              CIVIC INTELLIGENCE SYSTEM
            </p>
          )}

          {/* Thin progress line */}
          {phase >= 4 && (
            <div
              style={{
                width: "100%",
                height: "1px",
                backgroundColor: "#1F1F1F",
                marginTop: "2rem",
                overflow: "hidden",
                borderRadius: "1px",
              }}
            >
              <div
                className="ui-intro-bar"
                style={{
                  height: "100%",
                  backgroundColor: "#D6D4CF",
                  width: 0,
                }}
              />
            </div>
          )}

          {/* System nav labels */}
          {phase >= 4 && (
            <div
              style={{
                display: "flex",
                gap: "clamp(1rem, 4vw, 2rem)",
                marginTop: "1.25rem",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {navLabels.map((label, i) => (
                <span
                  key={label}
                  className={`ui-intro-nav ui-nav-item-${i + 1}`}
                  style={{
                    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
                    fontSize: "0.55rem",
                    fontWeight: 600,
                    letterSpacing: "0.22em",
                    color: "#6B6B6B",
                    opacity: 0,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Corner version / status line */}
        {phase >= 4 && (
          <div
            className="ui-intro-nav"
            style={{
              position: "absolute",
              bottom: "1.5rem",
              left: "1.5rem",
              fontSize: "0.55rem",
              letterSpacing: "0.14em",
              color: "#4A4A4A",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              opacity: 0,
            }}
          >
            SYSTEM INITIALIZING
          </div>
        )}
      </div>
    </>
  );
}
