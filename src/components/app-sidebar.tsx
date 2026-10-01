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
  ScrollText,
} from "lucide-react";
import Image from "next/image";
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
  audit: ScrollText,
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
          {/* Gold-rimmed badge around the Nib mark. */}
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F6D27A] via-[#D9A441] to-[#A8742A] p-[3px] shadow-[0_4px_10px_-2px_rgba(91,64,48,0.45)]">
            <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-b from-white to-[#FBF3E2] shadow-[inset_0_1px_3px_rgba(91,64,48,0.25)]">
              <Image src="/niblogo.png" alt="Nib International Bank" width={30} height={30} className="size-[30px] drop-shadow-[0_1px_1px_rgba(91,64,48,0.35)]" priority />
            </div>
          </div>
          <p className="bg-gradient-to-r from-[#5B4030] to-[#9A6A2E] bg-clip-text text-lg font-bold tracking-tight text-transparent">
            Strategic Plan
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex-1 gap-5 py-2">
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
