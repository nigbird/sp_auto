import { getUsers } from "@/actions/users";
import { getDepartments } from "@/actions/departments";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions-server";
import { PlanImportClient } from "@/components/strategic-plan/plan-import-client";

export default async function ImportStrategicPlanPage() {
    const currentUser = await requireUser();
    const [userList, departmentList, canRegister] = await Promise.all([
        getUsers(),
        getDepartments(),
        hasPermission(currentUser.roleId, 'settings:users:manage'),
    ]);
    const users = userList
        .map(u => ({ id: u.id, name: u.name, email: u.email, leadOwner: u.leadOwner ?? null, department: u.department ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const departments = departmentList.map(d => d.name);
    return <PlanImportClient users={users} departments={departments} canRegister={canRegister} />;
}
