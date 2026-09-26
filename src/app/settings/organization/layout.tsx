import { PageTabs } from "@/components/page-tabs";

/**
 * Departments and the lead-owner offices that sit in them, managed together:
 * each office has a default department, and people are linked to both.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Organization</h2>
        <p className="text-muted-foreground">
          The departments activities belong to, and the lead-owner offices (e.g. &ldquo;Chief Strategy Officer&rdquo;) that lead them. Link people to both under Users &amp; Roles.
        </p>
      </div>
      <PageTabs
        tabs={[
          { href: "/settings/organization/departments", label: "Departments" },
          { href: "/settings/organization/lead-owners", label: "Lead Owners" },
        ]}
      />
      {children}
    </div>
  );
}
