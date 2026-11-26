
"use client";

import { useEffect } from "react";
import { usePathname } from 'next/navigation'
import { toast } from "@/hooks/use-toast";
import { describeError } from "@/lib/action-error";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";

// Keep in step with PUBLIC_PAGES in src/proxy.ts: these are opened signed out,
// so they must not get the app shell, whose header calls signed-in server actions.
const AUTH_PAGES = ["/login", "/forgot-password", "/set-password", "/confirm-email"];

// VA-008: Next.js publishes its exact version as window.next.version, which is
// what fingerprinting tools report. Nothing reads it (Next only writes it), so
// drop it as soon as the app's code loads. The router and other fields stay.
if (typeof window !== "undefined") {
  delete (window as { next?: { version?: string } }).next?.version;
}

export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Safety net: an action that fails with no handler of its own still tells the person, instead of failing silently.
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      toast({ title: "Something went wrong", description: describeError(reason), variant: "destructive" });
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => window.removeEventListener("unhandledrejection", onUnhandled);
  }, []);
  // Sign-in screens are full-page: no sidebar, header or session keep-alive.
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  // Rendered on the server as well, not deferred until after hydration. Holding the
  // page back until mount meant a page that calls redirect() or notFound() threw
  // only once the router was already mounted, and the router crashed with React
  // error #310 ("Rendered more hooks than during the previous render").
  return <AppLayout>{children}</AppLayout>;
}
