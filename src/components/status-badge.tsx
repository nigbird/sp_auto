import type { ActivityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<ActivityStatus, string> = {
  "Not Started": "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300 border-gray-300",
  "On Track": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300",
  "Completed As Per Target": "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300",
  "Delayed": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300",
  "Overdue": "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200 border-red-400",
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  const statusLabel = status === 'Overdue' ? 'Overdue & Not Started' : status;
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusStyles[status])}
    >
      {statusLabel}
    </Badge>
  );
}
