import { getUsers } from "@/actions/users";
import { getDepartments } from "@/actions/departments";
import { PlanImportClient } from "@/components/strategic-plan/plan-import-client";

export default async function ImportStrategicPlanPage() {
    const [userList, departmentList] = await Promise.all([getUsers(), getDepartments()]);
    const users = userList.map(u => ({ id: u.id, name: u.name })).sort((a, b) => a.name.localeCompare(b.name));
    const departments = departmentList.map(d => d.name);
    return <PlanImportClient users={users} departments={departments} />;
}
