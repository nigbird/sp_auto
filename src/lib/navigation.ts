import type { Permission } from "@/lib/auth/permissions";

export type NavItemDef = {
  href: string;
  label: string;
  icon: "dashboard" | "plans" | "myPlan" | "planApprovals" | "myReports" | "reportApprovals" | "performance" | "users" | "settings";
  /** Shown only to users holding at least one of these. The page itself enforces the same rule. */
  anyOf: Permission[];
  /** Match only the exact path, not sub-paths (for items whose sub-paths are other menu items). */
  exact?: boolean;
};

export const NAV_GROUPS: { label?: string; items: NavItemDef[] }[] = [
  {
    items: [{ href: "/", label: "Dashboard", icon: "dashboard", anyOf: ["dashboard:view"], exact: true }],
  },
  {
    label: "Planning",
    items: [
      { href: "/strategic-plan", label: "Strategic Plans", icon: "plans", anyOf: ["strategic-plan:view"] },
      { href: "/plan", label: "My Plan", icon: "myPlan", anyOf: ["my-plan:view"], exact: true },
      { href: "/plan/approvals", label: "Plan Approvals", icon: "planApprovals", anyOf: ["plan-approvals:view"] },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/reports/submit", label: "My Reports", icon: "myReports", anyOf: ["my-reports:view"] },
      { href: "/reports/approvals", label: "Report Approvals", icon: "reportApprovals", anyOf: ["report-approvals:view"] },
      { href: "/reports", label: "Performance Report", icon: "performance", anyOf: ["reports:view"], exact: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Users & Roles", icon: "users", anyOf: ["users:view"] },
      { href: "/settings", label: "Configuration", icon: "settings", anyOf: ["settings:view"] },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function canSeeNavItem(item: NavItemDef, permissions: readonly string[]) {
  return item.anyOf.some((p) => permissions.includes(p));
}

/** The first page this user may open — where "/" sends people without dashboard access. */
export function homePathFor(permissions: readonly string[]): string {
  return ALL_ITEMS.find((i) => canSeeNavItem(i, permissions))?.href ?? "/profile";
}
