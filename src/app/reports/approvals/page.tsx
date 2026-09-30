import { guardPage } from "@/lib/auth/page-guard";
import { getPendingPeriodReports } from "@/actions/period-reports";
import { ReportApprovalList } from "@/components/approvals/report-approval-list";
import type { PeriodReportEntry } from "@/components/my-activity/my-activity-report-list";

export default async function ReportApprovalsPage() {
  const { denied } = await guardPage('report-approvals:view');
  if (denied) return denied;
  const pendingReports = await getPendingPeriodReports();

  return (
    <div className="flex-1 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Report Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review submitted period reports.
        </p>
      </div>
      <ReportApprovalList reports={pendingReports as PeriodReportEntry[]} />
    </div>
  );
}
