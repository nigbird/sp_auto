"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Volume2, VolumeX } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import type { Notification } from "@/lib/types";
import {
  NOTIFICATIONS_CHANGED_EVENT,
  announceNotificationsChanged,
  useNotificationSound,
} from "@/lib/notification-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "@/components/list-controls";
import { inDateRange, isRangeSet, matchesSearch, type DateRangeValue } from "@/lib/list-filters";

const TYPE_LABELS: Record<string, string> = {
  UPDATE_APPROVED: "Approved",
  UPDATE_DECLINED: "Declined",
  ACTIVITY_ASSIGNED: "Assigned",
  PERIOD_OPENED: "Period opened",
  PERIOD_CLOSED: "Period closed",
  DEADLINE_APPROACHING: "Deadline",
  ACTIVITY_DELAYED: "Delayed",
  EVIDENCE_MISSING: "Evidence missing",
};

type Filter = "all" | "unread";
const ALL_TYPES = "all";

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d, yyyy");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState(ALL_TYPES);
  const [range, setRange] = useState<DateRangeValue>({});
  const { enabled: soundOn, setEnabled: setSoundOn } = useNotificationSound();

  const refresh = useCallback(() => {
    getNotifications().then(setNotifications);
  }, []);

  useEffect(() => {
    refresh();
    // The bell polls in the header; when it (or this page) changes read state,
    // reload here too.
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
  }, [refresh]);

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  const narrowed = query.trim() !== "" || type !== ALL_TYPES || isRangeSet(range);
  const visible = useMemo(() => (notifications ?? []).filter((n) =>
    (filter === "all" || !n.read) &&
    (type === ALL_TYPES || n.type === type) &&
    matchesSearch(query, n.message, TYPE_LABELS[n.type]) &&
    inDateRange(n.date, range)
  ), [notifications, filter, type, query, range]);
  const pages = usePagination(visible, `${filter}|${type}|${query}|${range.from}|${range.to}`, 25);

  const groups = useMemo(() => {
    const byDay = new Map<string, Notification[]>();
    for (const n of pages.items) {
      const label = dayLabel(new Date(n.date));
      byDay.set(label, [...(byDay.get(label) ?? []), n]);
    }
    return [...byDay.entries()];
  }, [pages.items]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    announceNotificationsChanged();
  };

  const handleClick = async (n: Notification) => {
    if (n.read) return;
    await markNotificationRead(n.id);
    announceNotificationsChanged();
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            <Label htmlFor="notification-sound" className="cursor-pointer text-sm">Sound</Label>
            <Switch id="notification-sound" checked={soundOn} onCheckedChange={setSoundOn} />
          </div>
          <Button variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark all as read
          </Button>
        </div>
      </div>

      <ListToolbar count={notifications && (narrowed ? `${visible.length} match` : `${visible.length} notifications`)}>
        <div className="flex gap-2">
          {(["all", "unread"] as const).map((f) => (
            <Button key={f} size="sm" className="h-9" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </Button>
          ))}
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search notifications" />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-full sm:w-48" aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <DateRangeFilter value={range} onChange={setRange} label="Any date" hint="Shows notifications received in this range." />
        {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={() => { setQuery(""); setType(ALL_TYPES); setRange({}); }}>Reset</Button>}
      </ListToolbar>

      <Card>
        <CardContent className="p-0">
          {notifications === null ? (
            <p className="py-14 text-center text-sm text-muted-foreground">Loading…</p>
          ) : groups.length === 0 ? (
            <EmptyState
              art="inbox"
              title={narrowed ? "No notifications match" : filter === "unread" ? "No unread notifications" : "No notifications yet"}
              description={narrowed ? "Try a different search, type or date range." : "Approvals, assignments, deadlines and reporting-period updates will show up here."}
            />
          ) : (
            groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="border-b bg-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                <ul className="divide-y">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClick(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50",
                          !n.read && "bg-accent/5",
                        )}
                      >
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !n.read && "bg-accent")} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className={cn("text-sm", !n.read && "font-medium")}>{n.message}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {TYPE_LABELS[n.type] && <Badge variant="secondary" className="font-normal">{TYPE_LABELS[n.type]}</Badge>}
                            <span title={format(new Date(n.date), "PPp")}>
                              {formatDistanceToNow(new Date(n.date), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </CardContent>
      </Card>
      <Pagination state={pages} noun="notifications" />
    </div>
  );
}
