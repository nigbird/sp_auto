"use client";

import { useEffect, useState } from "react";
import { Edit, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getRoles, createRole, updateRolePermissions, deleteRole } from "@/actions/roles";
import { RoleForm, type RoleFormValues } from "@/components/settings/role-form";

type RoleRow = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // undefined = dialog closed, null = creating, RoleRow = editing
  const [editingRole, setEditingRole] = useState<RoleRow | null | undefined>(undefined);
  const [deletingRole, setDeletingRole] = useState<RoleRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const loadRoles = async () => {
    setRoles(await getRoles());
    setIsLoading(false);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleSubmit = async (values: RoleFormValues) => {
    if (!editingRole && !values.name) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      if (editingRole) {
        await updateRolePermissions(editingRole.id, values.permissions);
        toast({ title: "Permissions Updated", description: `${editingRole.name}'s permissions have been saved.` });
      } else {
        await createRole(values.name, values.permissions);
        toast({ title: "Role Created", description: `"${values.name}" has been created.` });
      }
      setEditingRole(undefined);
      await loadRoles();
    } catch (error) {
      toast({
        title: editingRole ? "Could Not Update Permissions" : "Could Not Create Role",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteRole(deletingRole.id);
      toast({ title: "Role Deleted", description: `"${deletingRole.name}" has been removed.` });
      await loadRoles();
    } catch (error) {
      toast({
        title: "Could Not Delete Role",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setDeletingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>
              Create roles and choose which permissions each one grants. Built-in roles can be edited but not deleted.
            </CardDescription>
          </div>
          <Button onClick={() => setEditingRole(null)}>
            <Plus className="mr-2 h-4 w-4" /> Create Role
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading roles...
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystem ? "outline" : "secondary"}>
                        {role.isSystem ? "Built-in" : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{role.permissions.length} permissions</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditingRole(role)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit {role.name}</span>
                      </Button>
                      {!role.isSystem && (
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeletingRole(role)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete {role.name}</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editingRole !== undefined} onOpenChange={(open) => !open && setEditingRole(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit ${editingRole.name}` : "Create Role"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Change which permissions this role grants." : "Name the role and select the permissions it grants."}
            </DialogDescription>
          </DialogHeader>
          {editingRole !== undefined && (
            <RoleForm
              key={editingRole?.id ?? "new"}
              role={editingRole}
              isSaving={isSaving}
              onSubmit={handleSubmit}
              onCancel={() => setEditingRole(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingRole?.name}</strong> will be removed. A role that is still assigned to users cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
