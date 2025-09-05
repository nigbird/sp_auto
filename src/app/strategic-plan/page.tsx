
import { getReportData } from "@/lib/data";
import { StrategicPlanEditor } from "@/components/strategic-plan/strategic-plan-editor";

export default async function StrategicPlanPage() {
  const initialData = await getReportData();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Strategic Plan</h1>
      </div>
      <StrategicPlanEditor initialData={initialData} />
    </div>
  );
}
