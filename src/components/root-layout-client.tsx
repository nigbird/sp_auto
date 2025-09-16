
"use client";

import { usePathname } from 'next/navigation'
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";

export function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <AppLayout>{children}</AppLayout>
  );
}
