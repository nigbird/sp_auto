import { guardPage } from "@/lib/auth/page-guard";
import { getMyPeriodReports } from "@/actions/period-reports";
import { MyActivityReportList, type PeriodReportEntry } from "@/components/my-activity/my-activity-report-list";

export default async function MyReportsPage() {
  const { denied } = await guardPage('my-reports:view');
  if (denied) return denied;
  const entries = await getMyPeriodReports();

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">My Reports</h1>
        <p className="text-muted-foreground">
          Submit your period reports.
        </p>
      </div>
      <MyActivityReportList initialEntries={entries as PeriodReportEntry[]} />
    </div>
  );
}
