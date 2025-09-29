
"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ListTodo,
  BarChart3,
  Settings,
  CircleHelp,
  LogOut,
  UserCheck,
  Network,
  Gavel,
} from "lucide-react";
import { Logo } from "./icons";

export function AppSidebar() {
  const pathname = usePathname();

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
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/"
              isActive={pathname === "/"}
              tooltip="Dashboard"
            >
              <LayoutDashboard />
              Dashboard
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/activities"
              isActive={pathname === "/activities"}
              tooltip="Activities"
            >
              <ListTodo />
              Activities
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/my-activity"
              isActive={pathname === "/my-activity"}
              tooltip="My Activity"
            >
              <UserCheck />
              My Activity
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/reports"
              isActive={pathname === "/reports"}
              tooltip="Reports"
            >
              <BarChart3 />
              Reports
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/strategic-plan"
              isActive={pathname.startsWith("/strategic-plan")}
              tooltip="Strategic Plan"
            >
              <Network />
              Strategic Plan
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/settings/rules"
              isActive={pathname.startsWith("/settings/rules")}
              tooltip="Rules"
            >
              <Gavel />
              Rules
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/settings"
              isActive={pathname.startsWith("/settings") && !pathname.startsWith("/settings/rules")}
              tooltip="Settings"
            >
              <Settings />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
