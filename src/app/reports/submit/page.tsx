import { guardPage } from "@/lib/auth/page-guard";
import { getMyPeriodReports } from "@/actions/period-reports";
import { MyActivityReportList, type PeriodReportEntry } from "@/components/my-activity/my-activity-report-list";

export default async function MyReportsPage() {
  const { denied } = await guardPage('my-reports:view');
  if (denied) return denied;
  const entries = await getMyPeriodReports();

  return (
    <div className="flex-1 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Reports</h1>
        <p className="text-sm text-muted-foreground">
          Submit and track your period performance reports.
        </p>
      </div>
      <MyActivityReportList initialEntries={entries as PeriodReportEntry[]} />
    </div>
  );
}
