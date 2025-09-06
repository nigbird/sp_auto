
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

const permissionGroups = [
  {
    title: "Dashboard",
    permissions: [
      { id: "dashboard:view", label: "View Dashboard" },
    ],
  },
  {
    title: "Activities",
    permissions: [
      { id: "activities:view", label: "View All Activities" },
      { id: "activities:create", label: "Create Activities" },
      { id: "activities:edit", label: "Edit Activities" },
      { id: "activities:delete", label: "Delete Activities" },
    ],
  },
  {
    title: "My Activity",
    permissions: [
      { id: "my-activity:view", label: "View Own Activities" },
      { id: "my-activity:update", label: "Update Own Activity Progress" },
    ],
  },
  {
    title: "Reports",
    permissions: [
      { id: "reports:view", label: "View Reports" },
      { id: "reports:export", label: "Export Reports" },
    ],
  },
  {
    title: "Settings",
    permissions: [
      { id: "settings:view", label: "View Settings" },
      { id: "settings:users:manage", label: "Manage Users" },
      { id: "settings:roles:manage", label: "Manage Roles" },
    ],
  },
  {
    title: "Strategic Plan",
    permissions: [
      { id: "strategic-plan:view", label: "View Strategic Plan" },
      { id: "strategic-plan:edit", label: "Edit Strategic Plan" },
    ],
  },
];


export default function CreateRolePage() {
    const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});

    const handlePermissionChange = (id: string) => {
        setSelectedPermissions(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSelectAll = (permissions: { id: string }[]) => {
        const allSelected = permissions.every(p => selectedPermissions[p.id]);
        const newSelected = { ...selectedPermissions };
        permissions.forEach(p => {
            newSelected[p.id] = !allSelected;
        });
        setSelectedPermissions(newSelected);
    };

  return (
    <div className="flex-1 space-y-6">
       <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/settings/role-management">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Role</h1>
            <p className="text-muted-foreground">
                Define a new role and select the granular permissions it has for each page.
            </p>
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="role-name">Role Name</Label>
                    <Input id="role-name" placeholder="e.g., Event Manager" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role-description">Description</Label>
                    <Textarea id="role-description" placeholder="Briefly describe this role's purpose" />
                </div>
            </div>
            
            <Separator className="my-6" />

            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Permissions</h3>
                    <p className="text-sm text-muted-foreground">
                        Select the permissions for this role.
                    </p>
                </div>
                <div className="space-y-6">
                    {permissionGroups.map((group) => {
                        const allSelected = group.permissions.every(p => selectedPermissions[p.id]);
                        return (
                            <Card key={group.title} className="bg-muted/30">
                                <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                                    <CardTitle className="text-base">{group.title}</CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`select-all-${group.title}`}
                                            checked={allSelected}
                                            onCheckedChange={() => handleSelectAll(group.permissions)}
                                        />
                                        <Label htmlFor={`select-all-${group.title}`} className="text-sm font-normal">
                                            Select All
                                        </Label>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                     {group.permissions.map((permission) => (
                                        <div key={permission.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={permission.id}
                                                checked={!!selectedPermissions[permission.id]}
                                                onCheckedChange={() => handlePermissionChange(permission.id)}
                                            />
                                            <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                                                {permission.label}
                                            </Label>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
             <div className="flex justify-end gap-2 pt-8">
                <Button variant="outline" type="button">Cancel</Button>
                <Button type="submit">Create Role</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
