
import { getUsers }from "@/actions/users";
import { getDepartments } from "@/actions/departments";
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { EditPlanClient } from "@/components/strategic-plan/edit-plan-client";
import type { User } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditStrategicPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const userList = await getUsers();
    const plan = await getStrategicPlanById(id);

    if (!plan) {
        notFound();
    }

    const departmentList = await getDepartments();

    const users = userList.map(u => ({ id: u.id, name: u.name }));
    const departments = departmentList.map(d => d.name);

    return (
        <EditPlanClient users={users} departments={departments} plan={plan} />
    );
}
