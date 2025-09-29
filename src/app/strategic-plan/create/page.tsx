
import { getUsers } from "@/actions/users";
import { getActivities } from "@/actions/activities";
import { CreatePlanClient } from "@/components/strategic-plan/create-plan-client";
import type { User } from "@/lib/types";

export default async function CreateStrategicPlanPage() {
    const userList = await getUsers();
    const activities = await getActivities();
    
    const users = userList.map(u => ({ id: u.id, name: u.name }));
    
    // Get unique departments from existing activities and add a base list
    const baseDepartments = ["Marketing", "Sales", "Engineering", "Human Resources", "Support", "Finance"];
    const activityDepartments = activities.map(a => a.department).filter(Boolean);
    const allDepartments = [...new Set([...baseDepartments, ...activityDepartments])];

    return (
        <CreatePlanClient users={users} departments={allDepartments} />
    );
}
