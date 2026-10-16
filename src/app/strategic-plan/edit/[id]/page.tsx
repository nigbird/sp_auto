import { guardPage } from "@/lib/auth/page-guard";

import { getUsers }from "@/actions/users";
import { getStrategicPlanById } from "@/actions/strategic-plan";
import { EditPlanClient } from "@/components/strategic-plan/edit-plan-client";
import type { User } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditStrategicPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { denied } = await guardPage('strategic-plan:edit');
  if (denied) return denied;
    const { id } = await params;
    const userList = await getUsers();
    const plan = await getStrategicPlanById(id);

    if (!plan) {
        notFound();
    }

    const users = userList.map(u => ({ id: u.id, name: u.name, leadOwner: u.leadOwner ?? null }));

    return (
        <EditPlanClient users={users} plan={plan} />
    );
}
