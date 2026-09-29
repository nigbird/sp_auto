import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/permissions-server";
import { homePathFor } from "@/lib/navigation";
import { loadDashboard } from "@/lib/dashboard-data";
import { ExecutiveDashboard, isDashboardTab } from "@/components/executive-dashboard/executive-dashboard";

// Always computed from live data for the selected plan and reporting period.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string; tab?: string }> }) {
  // "/" is everyone's landing page: without dashboard access, go to the first page they can open.
  const user = await requireUser();
  if (!userCan(user, "dashboard:view")) redirect(homePathFor(user.permissions));
  const { plan, period, tab } = await searchParams;
  const data = await loadDashboard(plan, period);
  return (
    <div className="flex-1">
      <ExecutiveDashboard data={data} tab={isDashboardTab(tab) ? tab : "overview"} />
    </div>
  );
}
