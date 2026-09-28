"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The access token is short-lived by design; this silently rotates it (and the
// refresh token) in the background while the user is actively using the app,
// so they're never kicked out mid-session. Each rotation also slides the
// server-side idle timeout (SESSION_IDLE_TIMEOUT_MINUTES) forward.
//
// It only refreshes when there's been real user activity since the last
// refresh — a tab left open and untouched is allowed to reach the idle timeout.
// If the refresh token itself is invalid/expired/reused, the user is sent back
// to /login. (Middleware also refreshes inline on the first request after a
// quiet spell, so a click never bounces a still-valid session.)
const TICK_MS = 30 * 1000;
const DEFAULT_REFRESH_EVERY_MS = 2 * 60 * 1000;
const MIN_WAKE_REFRESH_GAP_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

export function SessionKeepAlive() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let inFlight: Promise<void> | null = null;
    let lastRefreshAt = Date.now();
    let lastActivityAt = Date.now();
    // Refresh well before the access token expires; learned from the server's expiresIn.
    let refreshEveryMs = DEFAULT_REFRESH_EVERY_MS;

    function refresh(): Promise<void> {
      // One request at a time — parallel refreshes would race on token rotation.
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          const response = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          if (cancelled) return;
          if (response.ok) {
            lastRefreshAt = Date.now();
            const body = await response.json().catch(() => null);
            if (typeof body?.expiresIn === "number" && body.expiresIn > 0) {
              refreshEveryMs = Math.max(TICK_MS, body.expiresIn * 1000 * 0.6);
            }
          } else if (response.status === 401) {
            router.push("/login");
          }
        } catch {
          // Network hiccup — try again on the next tick rather than logging out.
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    }

    function markActive() {
      lastActivityAt = Date.now();
    }

    function tick() {
      const now = Date.now();
      const activeSinceLastRefresh = lastActivityAt > lastRefreshAt;
      if (activeSinceLastRefresh && now - lastRefreshAt >= refreshEveryMs) void refresh();
    }

    // Browsers throttle/freeze timers in background tabs and while the machine
    // sleeps, so coming back to the tab refreshes right away (or discovers the
    // session timed out) instead of waiting for the next tick.
    function onWake() {
      if (document.visibilityState !== "visible") return;
      markActive();
      if (Date.now() - lastRefreshAt >= MIN_WAKE_REFRESH_GAP_MS) void refresh();
    }

    const interval = setInterval(tick, TICK_MS);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, markActive, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      cancelled = true;
      clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActive, { capture: true });
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [router]);

  return null;
}
