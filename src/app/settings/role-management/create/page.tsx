
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { createRole } from "@/actions/roles";
import { PERMISSION_GROUPS } from "@/lib/auth/permissions";

export default function CreateRolePage() {
    const router = useRouter();
    const { toast } = useToast();
    const [roleName, setRoleName] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!roleName.trim()) {
            toast({ title: "Role name is required", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const permissions = Object.entries(selectedPermissions)
                .filter(([, checked]) => checked)
                .map(([id]) => id);
            await createRole(roleName.trim(), permissions);
            toast({ title: "Role Created", description: `"${roleName.trim()}" has been created.` });
            router.push("/settings/role-management");
        } catch (error) {
            toast({
                title: "Could Not Create Role",
                description: error instanceof Error ? error.message : "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

  return (
    <form onSubmit={handleSubmit} className="flex-1 space-y-6">
       <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" type="button">
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
                    <Input
                        id="role-name"
                        placeholder="e.g., Event Manager"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                    />
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
                    {PERMISSION_GROUPS.map((group) => {
                        const allSelected = group.permissions.every(p => selectedPermissions[p.id]);
                        return (
                            <Card key={group.title} className="bg-muted/30">
                                <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                                    <CardTitle className="text-base">{group.title}</CardTitle>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`select-all-${group.title}`}
                                            checked={allSelected}
                                            onCheckedChange={() => handleSelectAll(group.permissions as any)}
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
                <Button variant="outline" type="button" asChild>
                    <Link href="/settings/role-management">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Creating..." : "Create Role"}
                </Button>
            </div>
        </CardContent>
      </Card>
    </form>
  );
}
