"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  CircleHelp,
  UserCheck,
  Network,
  ClipboardCheck,
  FileText,
  FileCheck2,
  Users,
} from "lucide-react";
import { Logo } from "./icons";
import { getCurrentUserAction } from "@/actions/auth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the user holds at least one of these (UI hint only — pages/actions enforce access themselves). */
  anyOf?: string[];
  /** Match only the exact path, not sub-paths (for items whose sub-paths are other menu items). */
  exact?: boolean;
};

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Planning",
    items: [
      { href: "/strategic-plan", label: "Strategic Plans", icon: Network },
      { href: "/plan", label: "My Plan", icon: UserCheck, exact: true },
      { href: "/plan/approvals", label: "Plan Approvals", icon: ClipboardCheck },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/reports/submit", label: "My Reports", icon: FileText },
      { href: "/reports/approvals", label: "Report Approvals", icon: FileCheck2 },
      { href: "/reports", label: "Performance Reports", icon: BarChart3, exact: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Users & Roles", icon: Users, anyOf: ["settings:users:manage", "settings:roles:manage"] },
      { href: "/settings", label: "Settings", icon: Settings, anyOf: ["settings:view"] },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => {
    getCurrentUserAction().then((user) => setPermissions(user?.permissions ?? []));
  }, []);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  // Permission-gated items stay hidden until permissions have loaded, so they don't flash in and out.
  const canSee = (item: NavItem) =>
    !item.anyOf || (permissions !== null && item.anyOf.some((p) => permissions.includes(p)));

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <Logo className="size-8 text-sidebar-primary" />
          <div className="flex flex-col">
            <p className="text-lg font-semibold text-sidebar-foreground">
              Corp-Plan
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1">
        {NAV_GROUPS.map((group, i) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label ?? i}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton href={item.href} isActive={isActive(item)} tooltip={item.label}>
                      <item.icon />
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="/help" isActive={pathname === "/help"}>
              <CircleHelp />
              Help
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
