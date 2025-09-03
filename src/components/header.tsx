"use client";

import {
  Bell,
  Download,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SidebarTrigger } from "./ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getNotifications } from "@/lib/data";
import type { Notification } from "@/lib/types";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    getNotifications().then(setNotifications);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between">
          <p className="font-medium">Notifications</p>
          <Button variant="link" size="sm" className="p-0 h-auto">Mark all as read</Button>
        </div>
        <div className="mt-4 space-y-4">
          {notifications.map((notification) => (
             <div className="flex items-start gap-3" key={notification.id}>
              <div className={`mt-1 h-2 w-2 rounded-full ${notification.read ? '' : 'bg-accent'}`} />
              <div>
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(notification.date, { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}


export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
      </div>

      <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <form className="ml-auto flex-1 sm:flex-initial">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activities..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
            />
          </div>
        </form>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Notifications />
      </div>
    </header>
  );
}
