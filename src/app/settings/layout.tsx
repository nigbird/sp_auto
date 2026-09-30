import { guardPage } from "@/lib/auth/page-guard";
import { PageTabs } from "@/components/page-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { denied } = await guardPage("settings:view");
  if (denied) return denied;
  return (
    <div className="flex-1 space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuration</h1>
        <p className="text-sm text-muted-foreground">
          System-wide configuration for planning and reporting.
        </p>
      </div>
      <PageTabs
        tabs={[
          { href: "/settings/reporting-periods", label: "Reporting Periods" },
          { href: "/settings/rules", label: "Performance Rules" },
          { href: "/settings/organization", label: "Departments & Lead Owners" },
        ]}
      />
      {children}
    </div>
  );
}
