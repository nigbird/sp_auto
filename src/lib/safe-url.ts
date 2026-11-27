/**
 * Returns `url` only if it is an http(s) link to this app's own origin, else
 * null. Use before putting any non-constant value into an `href`, so that a
 * `javascript:`, `data:` or off-site URL can never end up in a link (DOM XSS /
 * open redirect), whatever produced the value.
 */
export function safeSameOriginHref(url: string | null | undefined): string | null {
  if (!url || typeof window === "undefined") return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.origin !== window.location.origin) return null;
    return parsed.href;
  } catch {
    return null;
  }
}
