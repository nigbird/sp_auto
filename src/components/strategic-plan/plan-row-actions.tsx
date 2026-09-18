"use client";

import Link from "next/link";
import { Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishButton } from "@/components/strategic-plan/publish-button";
import { DeletePlanButton } from "@/components/strategic-plan/delete-plan-button";

export function PlanRowActions({ planId, planName, status }: { planId: string; planName: string; status: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/strategic-plan/edit/${planId}`}>
          <Edit className="mr-2 h-4 w-4" /> Edit
        </Link>
      </Button>
      <DeletePlanButton planId={planId} planName={planName} />
      {status !== "PUBLISHED" && <PublishButton planId={planId} />}
    </div>
  );
}
