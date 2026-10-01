import type { Metadata } from "next";
import "./globals.css";
import { RootLayoutClient } from "@/components/root-layout-client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Strategic Plan | Nib International Bank",
  description: "Corporate Activity Plan & Dashboard Automation System",
  icons: { icon: "/niblogo.png", apple: "/niblogo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={cn("h-full font-body antialiased")}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
