"use client";

import { useCallback, useSyncExternalStore } from "react";

// Per-browser preference: sound is a property of the device someone is sitting
// at (an office desktop vs. a laptop in a meeting), so it lives in localStorage
// rather than on the user record. On by default.
const STORAGE_KEY = "notification-sound";
const CHANGE_EVENT = "notification-sound-change";

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  // "storage" covers other tabs; the custom event covers this tab, since
  // localStorage writes don't fire "storage" in the tab that made them.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useNotificationSound() {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => true);

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Storage blocked: the toggle just won't persist.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    if (next) playNotificationSound();
  }, []);

  return { enabled, setEnabled };
}

let audioContext: AudioContext | null = null;

/**
 * A short two-note chime synthesized with Web Audio, so there's no sound file
 * to ship. Browsers keep audio suspended until the page has seen a user
 * gesture; before that this is silently a no-op.
 */
export function playNotificationSound() {
  if (!readEnabled()) return;
  try {
    audioContext ??= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const t = start + i * 0.12;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // No Web Audio support: stay silent.
  }
}

// Fired after anything marks notifications read, so the bell and the
// notifications page stay in step without waiting for the next poll.
export const NOTIFICATIONS_CHANGED_EVENT = "notifications-changed";

export function announceNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
