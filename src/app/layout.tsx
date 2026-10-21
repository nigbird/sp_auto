import type { Metadata } from "next";
import { connection } from "next/server";
// Inter is bundled and served from this origin, so the Content-Security-Policy needs no third-party font hosts.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { RootLayoutClient } from "@/components/root-layout-client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Strategic Plan | Nib International Bank",
  description: "Corporate Activity Plan & Dashboard Automation System",
  icons: { icon: "/niblogo.png", apple: "/niblogo.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render every page per request: the CSP nonce (src/middleware.ts) is new each
  // time, and a page prerendered at build time would carry no nonce at all.
  await connection();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("h-full font-body antialiased")}>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
