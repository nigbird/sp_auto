"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { sendReportRequest } from "@/actions/period-reports";
import type { ReportingPeriod } from "@/lib/types";

export interface ReportSummary { requested: number; submitted: number; approved: number; returned: number; total: number }

/** Counts shown under a period once its report request has gone out. */
export function ReportSummaryBadges({ summary }: { summary?: ReportSummary }) {
  if (!summary || summary.total === 0) return null;
  return (
    <div className="flex flex-wrap justify-center gap-1 text-[10px]">
      <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">{summary.approved}/{summary.total} approved</Badge>
      {summary.submitted > 0 && <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10">{summary.submitted} to review</Badge>}
      {summary.requested > 0 && <Badge variant="outline">{summary.requested} not submitted</Badge>}
      {summary.returned > 0 && <Badge variant="destructive">{summary.returned} returned</Badge>}
    </div>
  );
}

/**
 * The period's "Send Report Request" step: a message for the activity owners
 * and a button that sends each of them the report rows to fill in.
 */
export function ReportRequestButton({ period, disabledReason, onSent }: { period: ReportingPeriod & { reportRequestMessage?: string | null; reportRequestSentAt?: string | Date | null }; disabledReason?: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(period.reportRequestMessage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const alreadySent = !!period.reportRequestSentAt;

  const handleOpen = () => {
    setMessage(period.reportRequestMessage ?? `Please submit your ${period.name} performance report by ${format(new Date(period.cutOffDate), "PP")}.`);
    setError(null);
    setOpen(true);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError("Write a short message for the activity owners.");
      return;
    }
    setIsSending(true);
    try {
      const result = await sendReportRequest(period.id, message);
      if (!result.success) {
        setError(result.fieldErrors?.message ?? result.message);
        return;
      }
      toast({
        title: "Report request sent",
        description: result.count
          ? `${result.count} ${result.count === 1 ? 'activity' : 'activities'} sent to their owners for "${period.name}".`
          : `No new activities to add — everyone who should report "${period.name}" already has the request.`,
      });
      setOpen(false);
      onSent();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <Button size="sm" variant={alreadySent ? "outline" : "default"} onClick={handleOpen} disabled={!!disabledReason} title={disabledReason}>
          <Send className="mr-2 h-3.5 w-3.5" /> {alreadySent ? "Send again" : "Send Report Request"}
        </Button>
        {alreadySent && <span className="text-[10px] text-muted-foreground">Sent {format(new Date(period.reportRequestSentAt!), "PP")}</span>}
        {disabledReason && <span className="text-[10px] text-muted-foreground max-w-[180px] text-center">{disabledReason}</span>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request reports for {period.name}</DialogTitle>
            <DialogDescription>
              Each activity with an approved monthly breakdown that has started by {format(new Date(period.endDate), "PP")} gets a report row for its responsible person, who is notified with your message.
              {alreadySent && " Sending again only adds activities that weren't requested yet — submitted and approved reports stay as they are."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor={`report-msg-${period.id}`}>Message to activity owners</Label>
            <Textarea id={`report-msg-${period.id}`} rows={4} value={message} onChange={(e) => { setMessage(e.target.value); setError(null); }} />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>Cancel</Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Report Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
