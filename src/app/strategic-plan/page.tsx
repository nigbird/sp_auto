import Link from 'next/link';
import { listStrategicPlans } from '@/actions/strategic-plan';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, PlusCircle } from 'lucide-react';
import { PlanListTable } from '@/components/strategic-plan/plan-list-table';
import { Can } from '@/components/permissions-provider';
import { EmptyState } from "@/components/empty-state";

export default async function StrategicPlanListPage() {
  const plans = await listStrategicPlans({ includeInactive: true });

  // The plan the rest of the system defaults to: the published one among the
  // active plans, else the most recently updated active plan — same rule the
  // dashboard and reports use to pick a plan when none is specified.
  const activePlans = plans.filter(p => p.isActive);
  const currentPlanId = (activePlans.find(p => p.status === 'PUBLISHED') ?? activePlans[0])?.id;

  return (
    <div className="flex-1">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Strategic Plans</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Manage every plan the organization runs on.</p>
          </div>
          <Can anyOf={["strategic-plan:edit"]}>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/strategic-plan/import">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import from Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href="/strategic-plan/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New Plan
              </Link>
            </Button>
          </div>
          </Can>
        </div>

        {plans.length === 0 ? (
          <div className="border-t border-border/60">
            <EmptyState art="plan" title="No strategic plans yet" description="Get started by creating or importing one." />
          </div>
        ) : (
          <PlanListTable
            plans={plans.map(p => ({ id: p.id, name: p.name, version: p.version, startYear: p.startYear, endYear: p.endYear, status: p.status, isActive: p.isActive, updatedAt: p.updatedAt }))}
            currentPlanId={currentPlanId}
          />
        )}
      </div>
    </div>
  );
}
