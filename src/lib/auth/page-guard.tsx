import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireUser, type SessionUser } from "./session";
import { userCan } from "./permissions-server";
import type { Permission } from "./permissions";
import { homePathFor } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function NoAccess({ home }: { home: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardContent className="flex flex-col items-center gap-3 pt-8 pb-8 text-center">
        <ShieldX className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">You don't have access to this page</h1>
        <p className="text-sm text-muted-foreground">Ask an administrator if you need it.</p>
        <Button asChild variant="outline"><Link href={home}>Go to my home page</Link></Button>
      </CardContent>
    </Card>
  );
}

/**
 * Use at the top of a server page or layout:
 *   const { user, denied } = await guardPage("reports:view");
 *   if (denied) return denied;
 * Nothing on the page is loaded or rendered for someone without access.
 */
export async function guardPage(...anyOf: Permission[]): Promise<{ user: SessionUser; denied: React.ReactElement | null }> {
  const user = await requireUser();
  if (userCan(user, ...anyOf)) return { user, denied: null };
  return { user, denied: <NoAccess home={homePathFor(user.permissions)} /> };
}
