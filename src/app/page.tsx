import { getReportData } from "@/lib/data";
import { generateReportSummary } from "@/lib/utils";
import { ReportSummaryCards } from "@/components/reports/summary-cards";

export default async function DashboardPage() {
  const reportData = await getReportData();
  const summary = generateReportSummary(reportData);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>
      <ReportSummaryCards summary={summary} />
    </div>
  );
}
