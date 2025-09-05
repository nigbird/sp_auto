"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function RoleManagementPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
          <p className="text-muted-foreground">Define roles and their permissions.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application Roles</CardTitle>
          <CardDescription>
            Create, edit, or delete roles and manage their associated permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Role management table will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}