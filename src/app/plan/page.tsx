import { requireUser } from "@/lib/auth/session";
import { getActivities } from "@/actions/activities";
import { getMyPeriodReports } from "@/actions/period-reports";
import { getUsers } from "@/actions/users";
import { listStrategicPlans, getStrategicPlanById } from "@/actions/strategic-plan";
import { getReportingPeriods } from "@/actions/reporting-periods";
import { MyPlanView } from "@/components/my-activity/my-plan-view";
import type { LatestReport } from "@/components/my-activity/my-activity-overview";
import type { ReportingPeriod, StrategicPlan, User } from "@/lib/types";

export default async function MyPlanPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const [user, allPlans] = await Promise.all([requireUser(), listStrategicPlans()]);

  const plans = allPlans.filter(p => p.status === "PUBLISHED");
  const planId = plans.find(p => p.id === planParam)?.id ?? plans[0]?.id;

  if (!planId) {
    return <MyPlanView plans={[]} plan={null} activities={[]} reports={[]} periods={[]} users={[]} />;
  }

  // "My Plan" is personal: only the activities this user is responsible for,
  // even for users who may view everyone's (Plan Approvals / Performance Report cover those).
  const [activities, plan, periods, reports, users] = await Promise.all([
    getActivities(planId, false, user.id),
    getStrategicPlanById(planId),
    getReportingPeriods(planId),
    getMyPeriodReports(),
    getUsers(),
  ]);

  return (
    <MyPlanView
      plans={plans.map(p => ({ id: p.id, name: p.name, version: p.version }))}
      plan={plan as unknown as StrategicPlan}
      activities={activities}
      reports={reports as LatestReport[]}
      periods={JSON.parse(JSON.stringify(periods)) as ReportingPeriod[]}
      users={users as unknown as User[]}
    />
  );
}
