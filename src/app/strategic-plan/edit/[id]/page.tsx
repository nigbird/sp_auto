
import { getUsers }from "@/actions/users";
import { getActivities } from "@/actions/activities";
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { EditPlanClient } from "@/components/strategic-plan/edit-plan-client";
import type { User } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditStrategicPlanPage({ params }: { params: { id: string } }) {
    const userList = await getUsers();
    const plan = await getStrategicPlanById(params.id);

    if (!plan) {
        notFound();
    }
    
    const planActivities = await getActivities(plan.id);
    
    const users = userList.map(u => ({ id: u.id, name: u.name }));
    
    // Get unique departments from existing activities and add a base list
    const baseDepartments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];
    const activityDepartments = planActivities.map(a => a.department).filter(Boolean);
    const allDepartments = [...new Set([...baseDepartments, ...activityDepartments])];

    return (
        <EditPlanClient users={users} departments={allDepartments} plan={plan} />
    );
}
