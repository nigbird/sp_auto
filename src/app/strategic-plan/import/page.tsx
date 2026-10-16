import { guardPage } from "@/lib/auth/page-guard";
import { getUsers } from "@/actions/users";
import { requireUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/permissions-server";
import { PlanImportClient } from "@/components/strategic-plan/plan-import-client";

export default async function ImportStrategicPlanPage() {
  const { denied } = await guardPage('strategic-plan:edit');
  if (denied) return denied;
    const currentUser = await requireUser();
    const [userList, canRegister] = await Promise.all([
        getUsers(),
        userCan(currentUser, 'users:manage'),
    ]);
    const users = userList
        .map(u => ({ id: u.id, name: u.name, email: u.email, leadOwner: u.leadOwner ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return <PlanImportClient users={users} canRegister={canRegister} />;
}
