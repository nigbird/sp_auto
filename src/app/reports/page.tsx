
import { getReportData } from "@/actions/reports";
import { ReportTable } from "@/components/reports/report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage() {
  const reportData = await getReportData();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>
      <ReportTable data={reportData} />
    </div>
  );
}
