
"use client";

import Link from "next/link";
import { ArrowLeft, PlusCircle, MoreHorizontal } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getRoles } from "@/actions/roles";
import { useEffect, useState } from "react";

type Role = {
    name: string;
    description: string;
    permissions: number;
}

export default function RoleManagementPage() {
    const [roles, setRoles] = useState<Role[]>([]);

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
            <p className="text-muted-foreground">Define roles and their permissions.</p>
            </div>
        </div>
         <Button asChild>
              <Link href="/settings/role-management/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Role
              </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application Roles</CardTitle>
          <CardDescription>
            Create, edit, or delete roles and manage their associated permissions.
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
                <TableRow key={role.name}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{role.permissions} permissions</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
