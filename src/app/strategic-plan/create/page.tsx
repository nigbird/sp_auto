import { guardPage } from "@/lib/auth/page-guard";

import { getUsers } from "@/actions/users";
import { CreatePlanClient } from "@/components/strategic-plan/create-plan-client";
import type { User } from "@/lib/types";

export default async function CreateStrategicPlanPage() {
  const { denied } = await guardPage('strategic-plan:edit');
  if (denied) return denied;
    const userList = await getUsers();
    const users = userList.map(u => ({ id: u.id, name: u.name, leadOwner: u.leadOwner ?? null }));

    return (
        <CreatePlanClient users={users} />
    );
}
