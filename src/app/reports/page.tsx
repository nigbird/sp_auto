import { getReportData } from "@/lib/data";
import { ReportTable } from "@/components/reports/report-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReportsPage() {
  const reportData = await getReportData();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Pillar Progress</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <p>Charts will be added here soon.</p>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>KPI Performance</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <p>Visualizations will be added here soon.</p>
          </CardContent>
        </Card>
      </div>
      <ReportTable data={reportData} />
    </div>
  );
}
