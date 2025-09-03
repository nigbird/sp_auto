
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reports Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the reports page. Content will be added here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
