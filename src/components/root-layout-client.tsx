
"use client";

import { usePathname } from 'next/navigation'
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
