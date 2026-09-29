"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { setStrategicPlanActive } from "@/actions/strategic-plan";

/** Toggles a plan's visibility across every plan selector in the app (dashboard, reports, approvals). */
export function PlanActivationButton({ planId, planName, isActive }: { planId: string; planName: string; isActive: boolean }) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const run = async (next: boolean) => {
    setPending(true);
    try {
      await setStrategicPlanActive(planId, next);
      toast({
        title: next ? "Plan Activated" : "Plan Deactivated",
        description: next
          ? `"${planName}" is visible across the system again.`
          : `"${planName}" is now hidden everywhere except this list.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        title: next ? "Could Not Activate Plan" : "Could Not Deactivate Plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  if (!isActive) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-primary hover:bg-primary/10 hover:text-primary"
        onClick={() => run(true)}
        disabled={pending}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
        Activate
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" disabled={pending}>
          <PowerOff className="mr-2 h-4 w-4" /> Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate &quot;{planName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from every plan selector across the system — dashboards, reports, and approvals. Nothing is deleted; reactivate it here any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run(false);
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
