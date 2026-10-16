
"use client";

import { useEffect } from "react";
import { usePathname } from 'next/navigation'
import { toast } from "@/hooks/use-toast";
import { describeError } from "@/lib/action-error";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";
import { ClientOnly } from './client-only';

const AUTH_PAGES = ["/login", "/forgot-password", "/set-password"];

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

  return (
    <ClientOnly>
      <AppLayout>{children}</AppLayout>
    </ClientOnly>
  );
}
