import type { ActivityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<ActivityStatus, string> = {
  Planned: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300",
  "In Progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border-yellow-300",
  Completed: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300",
  Delayed: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300",
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusStyles[status])}
    >
      {status}
    </Badge>
  );
}
