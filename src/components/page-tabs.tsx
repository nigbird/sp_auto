"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type PageTab = { href: string; label: string };

/**
 * Route-backed tabs: each tab is its own URL (so it can be linked to and
 * survives a refresh), styled to match the in-page <Tabs> component.
 * The active tab is the one whose href is the longest prefix of the path.
 */
export function PageTabs({ tabs }: { tabs: PageTab[] }) {
  const pathname = usePathname();
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
            tab === active && "bg-background text-foreground shadow-sm"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
