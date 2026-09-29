import Link from 'next/link';
import { listStrategicPlans } from '@/actions/strategic-plan';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanRowActions } from '@/components/strategic-plan/plan-row-actions';
import { Can } from '@/components/permissions-provider';

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

        <div className="border-t border-border/60">
          {plans.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No strategic plans yet. Get started by creating one.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Period</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last updated</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {plans.map(plan => {
                  const isCurrent = plan.id === currentPlanId;
                  return (
                    <tr
                      key={plan.id}
                      className={cn(
                        "group transition-colors",
                        isCurrent ? "bg-primary/[0.04]" : "hover:bg-muted/40"
                      )}
                      style={isCurrent ? { boxShadow: "inset 3px 0 0 0 hsl(var(--primary))" } : undefined}
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/strategic-plan/${plan.id}`}
                          className={cn("font-medium hover:underline", plan.isActive ? "text-foreground" : "text-muted-foreground")}
                        >
                          {plan.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">{plan.version}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{plan.startYear} – {plan.endYear}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                              plan.status === "PUBLISHED" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", plan.status === "PUBLISHED" ? "bg-primary" : "bg-muted-foreground/50")} />
                            {plan.status === "PUBLISHED" ? "Published" : "Draft"}
                          </span>
                          {!plan.isActive && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Deactivated
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{format(new Date(plan.updatedAt), 'PP')}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <PlanRowActions planId={plan.id} planName={plan.name} status={plan.status} isActive={plan.isActive} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
