import { useEffect, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * PageTransition
 *
 * Wraps page content with a subtle spatial entrance animation.
 * Triggered on every route change by keying off useLocation().pathname.
 *
 * Behaviour:
 * - New page fades + lifts in from slightly below (uia-page-enter)
 * - Duration: 380ms — short enough to feel responsive, long enough to feel premium
 * - No exit animation (avoids layout conflicts with React Router's render model)
 * - Reduced motion: class is applied but animation is a CSS no-op via media query
 * - Does NOT interfere with routing, auth guards, or existing layouts
 *
 * Usage in App.tsx:
 *   Wrap each <Route element={...}> content OR wrap inside each page root.
 *   The simplest approach: wrap the <Routes> block in App.tsx.
 */
interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef<string>(location.pathname);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (prevPathRef.current === location.pathname) return;

    prevPathRef.current = location.pathname;

    // Remove any in-flight class first so re-triggering works
    el.classList.remove("uia-page-enter");
    // Force a reflow so removing + re-adding the class restarts the animation
    void el.offsetWidth;
    el.classList.add("uia-page-enter");

    // Clean up class after animation completes (380ms + small buffer)
    const id = setTimeout(() => el.classList.remove("uia-page-enter"), 500);
    return () => clearTimeout(id);
  }, [location.pathname]);

  return (
    <div ref={wrapRef} style={{ minHeight: "inherit" }}>
      {children}
    </div>
  );
}
