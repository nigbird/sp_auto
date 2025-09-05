"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UserManagementPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts and roles.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Existing Users</CardTitle>
          <CardDescription>
            View, edit, or remove users from the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>User management table will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}