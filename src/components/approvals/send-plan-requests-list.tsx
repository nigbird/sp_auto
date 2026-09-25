"use client"

import * as React from "react"
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { sendPlanRequestsForInitiative } from "@/actions/activity-plan-submissions";
import { useToast } from "@/hooks/use-toast";

export interface InitiativeForPlanRequest {
  id: string;
  title: string;
  owner: { name: string } | null;
  objective: { statement: string; pillar: { title: string } };
  activities: {
    id: string;
    title: string;
    responsible: { name: string } | null;
    planRequestStatus: 'NOT_SENT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
  }[];
}

const REQUEST_LABEL: Record<InitiativeForPlanRequest['activities'][number]['planRequestStatus'], string> = {
  NOT_SENT: 'not sent',
  SENT: 'sent',
  ACCEPTED: 'sent',
  DECLINED: 'declined',
};

function statusCounts(activities: InitiativeForPlanRequest['activities']) {
  return {
    notSent: activities.filter(a => a.planRequestStatus === 'NOT_SENT').length,
    // ACCEPTED is left over from when owners had to accept a request; it means the same as SENT now.
    sent: activities.filter(a => a.planRequestStatus === 'SENT' || a.planRequestStatus === 'ACCEPTED').length,
    declined: activities.filter(a => a.planRequestStatus === 'DECLINED').length,
  };
}

export function SendPlanRequestsList({ initiatives: initialInitiatives }: { initiatives: InitiativeForPlanRequest[] }) {
  const [initiatives, setInitiatives] = React.useState(initialInitiatives);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const { toast } = useToast();

  const handleSend = async (initiative: InitiativeForPlanRequest) => {
    setSendingId(initiative.id);
    try {
      const result = await sendPlanRequestsForInitiative(initiative.id);
      if (!result.success) {
        toast({ title: "Couldn't send requests", description: result.message, variant: "destructive" });
        return;
      }
      setInitiatives((prev) => prev.map((i) => i.id === initiative.id
        ? { ...i, activities: i.activities.map(a => a.planRequestStatus === 'NOT_SENT' || a.planRequestStatus === 'DECLINED' ? { ...a, planRequestStatus: 'SENT' as const } : a) }
        : i
      ));
      toast({ title: "Breakdown requests sent", description: `Sent ${result.sent} request${result.sent === 1 ? '' : 's'} to the owners of "${initiative.title}"'s activities.` });
    } finally {
      setSendingId(null);
    }
  };

  if (initiatives.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No initiatives in a published plan yet. Publish a strategic plan first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {initiatives.map((initiative) => {
        const counts = statusCounts(initiative.activities);
        const hasSendable = counts.notSent + counts.declined > 0;
        return (
          <Card key={initiative.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold">{initiative.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {initiative.objective.pillar.title} → {initiative.objective.statement} · Owner: {initiative.owner?.name ?? "Unassigned"}
                </p>
              </div>
              <Button onClick={() => handleSend(initiative)} disabled={!hasSendable || sendingId === initiative.id}>
                {hasSendable ? "Send Plan Request" : "All Sent"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {counts.notSent > 0 && <Badge variant="outline">{counts.notSent} Not Sent</Badge>}
                {counts.sent > 0 && <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10">{counts.sent} Sent</Badge>}
                {counts.declined > 0 && <Badge variant="destructive">{counts.declined} Declined</Badge>}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {initiative.activities.map((a) => (
                  <li key={a.id}>{a.title} — {a.responsible?.name ?? "Unassigned"} ({REQUEST_LABEL[a.planRequestStatus]})</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
