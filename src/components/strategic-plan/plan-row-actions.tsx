"use client";

import Link from "next/link";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishButton } from "@/components/strategic-plan/publish-button";
import { DeletePlanButton } from "@/components/strategic-plan/delete-plan-button";
import { PlanActivationButton } from "@/components/strategic-plan/plan-activation-button";
import { usePermissions } from "@/components/permissions-provider";

export function PlanRowActions({ planId, planName, status, isActive }: { planId: string; planName: string; status: string; isActive: boolean }) {
  const { can } = usePermissions();
  const canEdit = can("strategic-plan:edit");
  const canDelete = can("strategic-plan:delete");
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {canEdit && (
        <>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link href={`/strategic-plan/edit/${planId}`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          {status !== "PUBLISHED" && <PublishButton planId={planId} />}
          <PlanActivationButton planId={planId} planName={planName} isActive={isActive} />
        </>
      )}
      {canEdit && canDelete && <div className="mx-1 h-4 w-px bg-border" />}
      {canDelete && <DeletePlanButton planId={planId} planName={planName} />}
    </div>
  );
}
