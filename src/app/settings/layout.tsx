import { PageTabs } from "@/components/page-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          System-wide configuration for planning and reporting.
        </p>
      </div>
      <PageTabs
        tabs={[
          { href: "/settings/reporting-periods", label: "Reporting Periods" },
          { href: "/settings/rules", label: "Performance Rules" },
          { href: "/settings/departments", label: "Departments" },
        ]}
      />
      {children}
    </div>
  );
}
