"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { sendPlanRequestsForPlan } from "@/actions/activity-plan-submissions";

/**
 * On a published plan: asks every activity's responsible person to fill in
 * their monthly breakdown. Only activities that haven't been sent a request
 * (or declined one) are included.
 */
export function SendBreakdownRequestsButton({ planId, sendableCount, ownerCount }: { planId: string; sendableCount: number; ownerCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSend = async () => {
    setIsSending(true);
    try {
      const result = await sendPlanRequestsForPlan(planId);
      if (!result.success) {
        toast({ title: "Couldn't send requests", description: result.message, variant: "destructive" });
        return;
      }
      toast({ title: "Breakdown requests sent", description: `${result.sent} ${result.sent === 1 ? 'activity was' : 'activities were'} sent to their owners. They'll see the request under My Activity → Monthly Breakdown.` });
      setIsOpen(false);
      router.refresh();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)} disabled={sendableCount === 0} title={sendableCount === 0 ? "Every activity already has a request sent or accepted." : undefined}>
        <Send className="mr-2 h-4 w-4" />
        {sendableCount === 0 ? "Breakdown requests sent" : `Send Monthly Breakdown Requests (${sendableCount})`}
      </Button>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send monthly breakdown requests?</AlertDialogTitle>
            <AlertDialogDescription>
              {sendableCount} {sendableCount === 1 ? 'activity' : 'activities'} will be sent to {ownerCount} {ownerCount === 1 ? 'person' : 'people'}. Each person fills in the annual target and the month(s) they'll finish by, then it goes to Approvals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send requests
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
