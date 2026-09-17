
"use client";

import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getRoles } from "@/actions/roles";
import { useEffect, useState } from "react";

type RoleRow = {
    role: string;
    name: string;
    description: string;
    permissions: string[];
};

export default function RoleManagementPage() {
    const [roles, setRoles] = useState<RoleRow[]>([]);

    useEffect(() => {
        getRoles().then(setRoles);
    }, []);

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
            <Link href="/settings">
                <ArrowLeft className="h-4 w-4" />
            </Link>
            </Button>
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">The 3 built-in roles and the permissions each one grants.</p>
            </div>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application Roles</CardTitle>
          <CardDescription>
            Edit a role to change which of the granular permissions it grants.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.role}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.permissions.length} permissions</Badge>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="icon" variant="ghost">
                      <Link href={`/settings/role-management/${role.role}`}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
