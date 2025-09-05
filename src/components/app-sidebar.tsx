
"use client";

import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { Logo } from "./icons";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

export function AppSidebar() {
  const pathname = usePathname();

  const handleLogout = () => {
    alert("Log out action triggered!");
  }

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
              isActive={pathname === "/strategic-plan"}
              tooltip="Strategic Plan"
            >
              <Network />
              Strategic Plan
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              href="/settings"
              isActive={pathname === "/settings"}
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
          <SidebarMenuItem>
            <div className="flex items-center gap-3 rounded-md p-2 hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src="https://picsum.photos/100" alt="Admin User" data-ai-hint="person" />
                <AvatarFallback>AU</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                  <p className="font-medium text-sidebar-foreground">Admin User</p>
                  <p className="text-xs text-sidebar-foreground/70">admin@corp-plan.com</p>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleLogout}>
                <LogOut className="size-5" />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
