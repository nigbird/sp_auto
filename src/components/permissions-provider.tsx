"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { getCurrentUserAction } from "@/actions/auth";
import type { Permission } from "@/lib/auth/permissions";

type PermissionsState = {
  /** null until loaded. */
  permissions: string[] | null;
  can: (...anyOf: Permission[]) => boolean;
};

const PermissionsContext = React.createContext<PermissionsState>({ permissions: null, can: () => false });

/**
 * The signed-in user's permissions for showing/hiding UI. Re-read on every
 * navigation so a role change shows up without signing out. This only hides
 * controls — every page and server action enforces the same permissions itself.
 */
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [permissions, setPermissions] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCurrentUserAction().then((user) => { if (!cancelled) setPermissions(user?.permissions ?? []); });
    return () => { cancelled = true; };
  }, [pathname]);

  const value = React.useMemo<PermissionsState>(() => ({
    permissions,
    can: (...anyOf) => !!permissions && anyOf.some((p) => permissions.includes(p)),
  }), [permissions]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  return React.useContext(PermissionsContext);
}

/** Renders its children only for users holding at least one of the permissions. */
export function Can({ anyOf, children, fallback = null }: { anyOf: Permission[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { can } = usePermissions();
  return <>{can(...anyOf) ? children : fallback}</>;
}
