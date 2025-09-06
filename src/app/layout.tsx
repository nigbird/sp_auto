"use client"

import type { Metadata } from "next";
import { usePathname } from 'next/navigation'
import "./globals.css";
import { AppLayout } from "@/components/app-layout";
import { Toaster } from "@/components/ui/toaster";

// Metadata cannot be exported from a client component, so we define it here.
// export const metadata: Metadata = {
//   title: "Corp-Plan Dashboard",
//   description: "Corporate Activity Plan & Dashboard Automation System",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Corp-Plan Dashboard</title>
        <meta name="description" content="Corporate Activity Plan & Dashboard Automation System" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        {isLoginPage ? (
          <>
            {children}
            <Toaster />
          </>
        ) : (
          <AppLayout>{children}</AppLayout>
        )}
      </body>
    </html>
  );
}
