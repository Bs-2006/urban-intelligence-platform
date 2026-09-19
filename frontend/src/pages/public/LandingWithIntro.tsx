import { useState } from "react";
import IntroSplash from "../../components/IntroSplash";
import LandingPage from "./LandingPage";

const SESSION_KEY = "ui_intro_seen";

// Shows IntroSplash once per browser session before the existing LandingPage.
// Add ?skip_intro=1 to the URL to bypass during development/testing.
export default function LandingWithIntro() {
  const skipViaParam =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("skip_intro") === "1";

  const alreadySeen =
    !skipViaParam &&
    typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem(SESSION_KEY) === "1";

  const [introDone, setIntroDone] = useState(alreadySeen);

  const handleIntroComplete = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // private/incognito — silently ignore
    }
    setIntroDone(true);
  };

  // While intro is active, render ONLY the intro — no landing page underneath.
  // This prevents the PublicLayout navbar from showing through the black overlay.
  if (!introDone) {
    return <IntroSplash onComplete={handleIntroComplete} />;
  }

  // Intro finished — render the existing Landing Page exactly as it was.
  return <LandingPage />;
}
