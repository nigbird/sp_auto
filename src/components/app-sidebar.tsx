"use client";

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
import { usePermissions } from "./permissions-provider";
import { NAV_GROUPS, canSeeNavItem, type NavItemDef } from "@/lib/navigation";

const ICONS: Record<NavItemDef["icon"], LucideIcon> = {
  dashboard: LayoutDashboard,
  plans: Network,
  myPlan: UserCheck,
  planApprovals: ClipboardCheck,
  myReports: FileText,
  reportApprovals: FileCheck2,
  performance: BarChart3,
  users: Users,
  settings: Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { permissions } = usePermissions();

  const isActive = (item: NavItemDef) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
        {/* Nothing is shown until permissions load, so items never flash in and out. */}
        {permissions && NAV_GROUPS.map((group, i) => {
          const items = group.items.filter((item) => canSeeNavItem(item, permissions));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label ?? i}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton href={item.href} isActive={isActive(item)} tooltip={item.label}>
                        <Icon />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
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
