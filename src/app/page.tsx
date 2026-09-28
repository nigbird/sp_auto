import { loadDashboard } from "@/lib/dashboard-data";
import { ExecutiveDashboard } from "@/components/executive-dashboard/executive-dashboard";

// Always computed from live data for the selected plan and reporting period.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string }> }) {
  const { plan, period } = await searchParams;
  const data = await loadDashboard(plan, period);
  return (
    <div className="flex-1">
      <ExecutiveDashboard data={data} />
    </div>
  );
}
