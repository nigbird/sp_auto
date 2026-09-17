
import { getUsers } from "@/actions/users";
import { getDepartments } from "@/actions/departments";
import { CreatePlanClient } from "@/components/strategic-plan/create-plan-client";
import type { User } from "@/lib/types";

export default async function CreateStrategicPlanPage() {
    const userList = await getUsers();
    const departmentList = await getDepartments();

    const users = userList.map(u => ({ id: u.id, name: u.name }));
    const departments = departmentList.map(d => d.name);

    return (
        <CreatePlanClient users={users} departments={departments} />
    );
}
