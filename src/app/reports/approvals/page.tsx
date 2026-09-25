import { getPendingPeriodReports } from "@/actions/period-reports";
import { ReportApprovalList } from "@/components/approvals/report-approval-list";
import type { PeriodReportEntry } from "@/components/my-activity/my-activity-report-list";

export default async function ReportApprovalsPage() {
  const pendingReports = await getPendingPeriodReports();

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Report Approvals</h1>
        <p className="text-muted-foreground">
          Approve submitted period reports, or return them to the owner with a reason.
        </p>
      </div>
      <ReportApprovalList reports={pendingReports as PeriodReportEntry[]} />
    </div>
  );
}
