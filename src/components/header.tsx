
"use client";

import {
  Bell,
  Search,
  Menu,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  announceNotificationsChanged,
  playNotificationSound,
  useNotificationSound,
} from "@/lib/notification-client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getNotifications, pollNotifications, markNotificationRead, markAllNotificationsRead } from "@/actions/notifications";
import { getCurrentUserAction } from "@/actions/auth";
import type { Notification } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/session";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { LayoutDashboard, UserCheck, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";


const POLL_INTERVAL_MS = 30_000;
const BELL_PREVIEW_COUNT = 8;

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const { enabled: soundOn, setEnabled: setSoundOn } = useNotificationSound();
  // Ids seen so far; null until the first load, so existing notifications
  // don't chime on page load — only ones that arrive while the page is open.
  const seenIds = useRef<Set<string> | null>(null);

  const apply = useCallback((list: Notification[]) => {
    const seen = seenIds.current;
    if (seen && list.some((n) => !n.read && !seen.has(n.id))) playNotificationSound();
    seenIds.current = new Set(list.map((n) => n.id));
    setNotifications(list);
  }, []);

  const refresh = useCallback(() => {
    getNotifications().then(apply);
  }, [apply]);

  useEffect(() => {
    refresh();
    const poll = () => {
      if (document.visibilityState === "visible") pollNotifications().then(apply).catch(() => {});
    };
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, poll);
    };
  }, [refresh, apply]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    announceNotificationsChanged();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.read) return;
    await markNotificationRead(notification.id);
    announceNotificationsChanged();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) refresh(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">Notifications</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSoundOn(!soundOn)}
              title={soundOn ? "Sound on — click to mute" : "Sound off — click to unmute"}
            >
              {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="sr-only">{soundOn ? "Turn notification sound off" : "Turn notification sound on"}</span>
            </Button>
            <Button variant="link" size="sm" className="p-0 h-auto" onClick={handleMarkAllRead} disabled={!hasUnread}>Mark all as read</Button>
          </div>
        </div>
        <div className="mt-4 space-y-4 max-h-96 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No notifications.</p>
          )}
          {notifications.slice(0, BELL_PREVIEW_COUNT).map((notification) => (
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
        <div className="mt-3 border-t pt-2 text-center">
          <Link href="/notifications" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
            View all notifications
          </Link>
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
