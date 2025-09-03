"use client";

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
} from "lucide-react";
import { Logo } from "./icons";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function AppSidebar() {
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
              href="#"
              isActive
              tooltip="Dashboard"
            >
              <LayoutDashboard />
              Dashboard
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Activities">
              <ListTodo />
              Activities
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Reports">
              <BarChart3 />
              Reports
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton href="#" tooltip="Settings">
              <Settings />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton href="#">
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
              <LogOut className="ml-auto size-5 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
