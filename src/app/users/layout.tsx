import { guardPage } from "@/lib/auth/page-guard";
import { PageTabs } from "@/components/page-tabs";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const { denied } = await guardPage("users:view");
  if (denied) return denied;
  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Users & Roles</h1>
        <p className="text-muted-foreground">
          Manage who can sign in, and what each role is allowed to do.
        </p>
      </div>
      <PageTabs
        tabs={[
          { href: "/users", label: "Users" },
          { href: "/users/roles", label: "Roles & Permissions" },
        ]}
      />
      {children}
    </div>
  );
}
