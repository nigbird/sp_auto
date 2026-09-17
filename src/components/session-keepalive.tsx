"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The access token is short-lived (5 min) by design; this silently rotates it
// (and the refresh token) in the background so a signed-in user isn't kicked
// out mid-session. If the refresh token itself is invalid/expired/reused, the
// user is sent back to /login.
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

export function SessionKeepAlive() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (!cancelled && !response.ok) {
          router.push("/login");
        }
      } catch {
        // Network hiccup — try again on the next tick rather than logging out.
      }
    }

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
