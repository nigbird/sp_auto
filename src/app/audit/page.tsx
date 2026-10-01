import { guardPage } from "@/lib/auth/page-guard";
import { userCan } from "@/lib/auth/permissions-server";
import { AuditLogView } from "@/components/audit/audit-log-view";

export default async function AuditLogPage() {
  const { user, denied } = await guardPage("audit:view");
  if (denied) return denied;
  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Who did what, and when: sign-ins, changes to plans, approvals, reports, users, roles and configuration.
        </p>
      </div>
      <AuditLogView canExport={userCan(user, "audit:export")} />
    </div>
  );
}
