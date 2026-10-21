import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** The "you can't open this page" screen, with a way back to the person's own home page. */
export async function NoAccess() {
  const user = await getCurrentUser();
  const home = user ? homePathFor(user.permissions) : "/login";
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
