"use client";

import { usePermissions } from "@/components/permissions-provider";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Building2, Check, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getDepartmentOverview, createDepartment, updateDepartment, deleteDepartment } from "@/actions/departments";

interface DepartmentRow {
  id: string;
  name: string;
  leadOwners: string[];
  people: number;
  activities: number;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[] | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renaming, setRenaming] = useState<{ row: DepartmentRow; to: string } | null>(null);
  const [deleting, setDeleting] = useState<DepartmentRow | null>(null);
  const { toast } = useToast();
  const canManage = usePermissions().can("settings:manage");

  const refresh = () => getDepartmentOverview().then(setDepartments);

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async () => {
    const result = await createDepartment(newName);
    if (!result.success) {
      toast({ title: "Could Not Add Department", description: result.message, variant: "destructive" });
      return;
    }
    setNewName("");
    refresh();
    toast({ title: "Department Added" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  /** Renaming something in use updates every place that uses it, so ask first. */
  const requestRename = (row: DepartmentRow) => {
    const to = editingName.trim();
    if (!to || to === row.name) { cancelEdit(); return; }
    if (row.activities + row.people + row.leadOwners.length > 0) setRenaming({ row, to });
    else doRename(row.id, to);
  };

  const doRename = async (id: string, to: string) => {
    const result = await updateDepartment(id, to);
    if (!result.success) {
      toast({ title: "Could Not Rename Department", description: result.message, variant: "destructive" });
      return;
    }
    setRenaming(null);
    cancelEdit();
    refresh();
    toast({ title: "Department Renamed" });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteDepartment(deleting.id);
    if (!result.success) {
      toast({ title: "Could Not Delete Department", description: result.message, variant: "destructive" });
      setDeleting(null);
      return;
    }
    setDepartments(prev => prev?.filter(d => d.id !== deleting.id) ?? null);
    setDeleting(null);
    toast({ title: "Department Deleted", variant: "destructive" });
  };

  const usage = (row: DepartmentRow) => [
    row.activities && `${row.activities} activit${row.activities === 1 ? "y" : "ies"}`,
    row.people && `${row.people} ${row.people === 1 ? "person" : "people"}`,
    row.leadOwners.length && `${row.leadOwners.length} lead owner${row.leadOwners.length === 1 ? "" : "s"}`,
  ].filter(Boolean).join(", ");

  return (
    <Card className="rounded-xl border-border/50 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_4px_12px_-8px_rgba(16,24,40,0.06)]">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Departments</CardTitle>
        <p className="text-sm text-muted-foreground">Activities can only be assigned to a department on this list.</p>
        {canManage && <div className="mt-2 flex flex-wrap gap-2">
          <Input
            placeholder="New department name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && handleAdd()}
            className="max-w-xs"
          />
          <Button onClick={handleAdd} disabled={!newName.trim()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Name</TableHead>
              <TableHead className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Lead Owners</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">People</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Activities</TableHead>
              <TableHead className="h-10 w-[140px] text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments === null && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {departments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-6 w-6" />
                  No departments defined yet.
                </TableCell>
              </TableRow>
            )}
            {departments?.map((department) => (
              <TableRow key={department.id} className="border-border/50 hover:bg-muted/30">
                <TableCell className="py-3.5 font-medium text-foreground">
                  {!canManage ? null : editingId === department.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") requestRename(department);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      autoFocus
                      className="max-w-xs"
                    />
                  ) : department.name}
                </TableCell>
                <TableCell>
                  {department.leadOwners.length === 0
                    ? <span className="text-muted-foreground">—</span>
                    : <div className="flex flex-wrap gap-1">{department.leadOwners.map(l => <Badge key={l} variant="outline" className="border-border/60 bg-muted/60 font-medium text-muted-foreground">{l}</Badge>)}</div>}
                </TableCell>
                <TableCell className="text-right text-foreground/90">{department.people || <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell className="text-right text-foreground/90">{department.activities || <span className="text-muted-foreground">0</span>}</TableCell>
                <TableCell className="text-center">
                  {editingId === department.id ? (
                    <>
                      <Button size="icon" variant="ghost" aria-label="Save" onClick={() => requestRename(department)}><Check className="h-4 w-4 text-emerald-600" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Cancel" onClick={cancelEdit}><X className="h-4 w-4 text-muted-foreground" /></Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => { setEditingId(department.id); setEditingName(department.name); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDeleting(department)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Lead owners are listed under their default department — set it on the <Link href="/settings/organization/lead-owners" className="underline underline-offset-2">Lead Owners</Link> tab.
        </p>
      </CardContent>

      <AlertDialog open={renaming !== null} onOpenChange={(open) => { if (!open) setRenaming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename &ldquo;{renaming?.row.name}&rdquo; to &ldquo;{renaming?.to}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              It's used by {renaming ? usage(renaming.row) : ""}. They'll all move to the new name, including activities in existing plans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => renaming && doRename(renaming.row.id, renaming.to)}>Rename everywhere</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.activities > 0
                ? `It can't be deleted yet: ${deleting.activities} activit${deleting.activities === 1 ? "y uses" : "ies use"} it. Move them to another department in the plan, or rename this department instead.`
                : deleting && (deleting.people + deleting.leadOwners.length) > 0
                  ? `${usage(deleting)} will be left without a department. Nothing else changes.`
                  : "Nothing uses this department."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!(deleting && deleting.activities > 0) && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
