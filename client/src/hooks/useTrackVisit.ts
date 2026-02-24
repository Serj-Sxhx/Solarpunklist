import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const DEBOUNCE_MS = 2000;

export function useTrackVisit() {
  const [location] = useLocation();
  const lastTracked = useRef<string>("");
  const lastTime = useRef<number>(0);

  useEffect(() => {
    const now = Date.now();
    if (location === lastTracked.current && now - lastTime.current < DEBOUNCE_MS) {
      return;
    }
    lastTracked.current = location;
    lastTime.current = now;

    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location }),
    }).catch(() => {});
  }, [location]);
}
