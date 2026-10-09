"use client";

import { usePermissions } from "@/components/permissions-provider";
import { useEffect, useState } from "react";
import { Edit, Eye, Plus, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListToolbar, Pagination, SearchBox, usePagination } from "@/components/list-controls";
import { matchesSearch } from "@/lib/list-filters";

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
  const canManage = usePermissions().can("roles:manage");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const narrowed = query.trim() !== "" || type !== "all";
  const matchingRoles = roles.filter(r =>
    matchesSearch(query, r.name, ...r.permissions) &&
    (type === "all" || (type === "system") === r.isSystem)
  );
  const rolePages = usePagination(matchingRoles, `${query}|${type}`);

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
      <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-foreground">Roles & Permissions</CardTitle>
            <CardDescription>
              Built-in roles can be edited but not deleted.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setEditingRole(null)}>
            <Plus className="mr-2 h-4 w-4" /> Create Role
          </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <ListToolbar count={narrowed ? `${matchingRoles.length} of ${roles.length} roles match` : `${roles.length} roles`}>
            <SearchBox value={query} onChange={setQuery} placeholder="Search role or permission" className="sm:w-80" />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Role type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="system">Built-in</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {narrowed && <Button variant="ghost" className="h-9 px-3" onClick={() => { setQuery(""); setType("all"); }}>Reset</Button>}
          </ListToolbar>
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Role Name</TableHead>
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Type</TableHead>
                  <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Permissions</TableHead>
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
                ) : matchingRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      {narrowed ? "No roles match the search or filters." : "No roles yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rolePages.items.map((role) => (
                    <TableRow key={role.id} className="border-border/50 hover:bg-muted/30">
                      <TableCell className="py-3.5 font-medium text-foreground">{role.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={role.isSystem ? "border-border/60 bg-muted/60 font-medium text-muted-foreground" : "border-primary/30 bg-primary/[0.06] font-medium text-primary"}>
                          {role.isSystem ? "Built-in" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border/60 bg-muted/60 font-medium text-muted-foreground">{role.permissions.length} permissions</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => setEditingRole(role)}>
                          {canManage ? <Edit className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          <span className="sr-only">{canManage ? "Edit" : "View"} {role.name}</span>
                        </Button>
                        {canManage && !role.isSystem && (
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
          </div>
          {!isLoading && <Pagination state={rolePages} noun="roles" />}
        </CardContent>
      </Card>

      <Dialog open={editingRole !== undefined} onOpenChange={(open) => !open && setEditingRole(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? `${canManage ? "Edit" : "View"} ${editingRole.name}` : "Create Role"}</DialogTitle>
            <DialogDescription>
              {!canManage ? "What this role is allowed to do." : editingRole ? "Change which permissions this role grants." : "Name the role and select the permissions it grants."}
            </DialogDescription>
          </DialogHeader>
          {editingRole !== undefined && (
            <RoleForm
              key={editingRole?.id ?? "new"}
              role={editingRole}
              isSaving={isSaving}
              onSubmit={handleSubmit}
              onCancel={() => setEditingRole(undefined)}
              readOnly={!canManage}
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
            <AlertDialogAction onClick={handleDelete} className="border border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/40 hover:bg-destructive/15">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
