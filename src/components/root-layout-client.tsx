
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

  return (
    <>
      {isLoginPage ? (
        <>
          {children}
          <Toaster />
        </>
      ) : (
        <AppLayout>{children}</AppLayout>
      )}
    </>
  );
}
