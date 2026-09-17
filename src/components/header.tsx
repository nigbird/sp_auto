
"use client";

import {
  Bell,
  Search,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import { getCurrentUserAction } from "@/actions/auth";
import type { Notification } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/session";
import { useEffect, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import { LayoutDashboard, UserCheck, Settings, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";


function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const refresh = () => {
    getNotifications().then(setNotifications);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    refresh();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.read) return;
    await markNotificationRead(notification.id);
    refresh();
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <p className="font-medium">Notifications</p>
          <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleMarkAllRead} disabled={!hasUnread}>Mark all as read</Button>
        </div>
        <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications.</p>
          )}
          {notifications.map((notification) => (
             <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="flex items-start gap-3 w-full text-left hover:bg-muted/50 rounded-md p-1 -m-1"
             >
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? '' : 'bg-accent'}`} />
              <div>
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(notification.date, { addSuffix: true })}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Header({ pageTitle, headerActions }: { pageTitle: ReactNode, headerActions?: ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    getCurrentUserAction().then(setCurrentUser);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
        <SidebarTrigger className="md:hidden" />
      
      <div className="flex items-center gap-4">
        {typeof pageTitle === 'string' ? <h1 className="text-lg font-semibold md:text-xl">{pageTitle}</h1> : pageTitle}
      </div>

      <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="relative ml-auto flex-1 md:grow-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
          />
        </div>
        {headerActions}
        <Notifications />
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={currentUser?.avatar} alt={currentUser?.name ?? "User"} data-ai-hint="person" />
                    <AvatarFallback>{currentUser?.name?.slice(0, 2).toUpperCase() ?? "U"}</AvatarFallback>
                  </Avatar>
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                 <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser?.name ?? "..."}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser?.role ?? ""}
                    </p>
                  </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserCheck className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </header>
  );
}
