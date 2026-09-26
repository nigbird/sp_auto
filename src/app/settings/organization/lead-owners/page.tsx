"use client";

import { useState, useEffect } from "react";
import { Check, Pencil, PlusCircle, Trash2, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getLeadOwners, createLeadOwner, updateLeadOwner, deleteLeadOwner } from "@/actions/lead-owners";
import { getDepartments } from "@/actions/departments";

const NONE = "__none__";

interface LeadOwnerRow {
  id: string;
  name: string;
  department: string | null;
  users: { id: string; name: string }[];
}

function DepartmentSelect({ value, onChange, departments }: { value: string; onChange: (v: string) => void; departments: string[] }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-[240px]"><SelectValue placeholder="No default department" /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No default department</SelectItem>
        {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/**
 * The offices that lead plan activities (the Excel's "Lead/ Owner (Activity)"
 * titles). People are linked to an office from their user record; plan imports
 * use this list to match each office to the person who holds it.
 */
export default function LeadOwnersPage() {
  const [leadOwners, setLeadOwners] = useState<LeadOwnerRow[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingDepartment, setEditingDepartment] = useState("");
  const [deleting, setDeleting] = useState<LeadOwnerRow | null>(null);
  const { toast } = useToast();

  const refresh = () => getLeadOwners().then(setLeadOwners);

  useEffect(() => {
    refresh();
    getDepartments().then(list => setDepartments(list.map(d => d.name)));
  }, []);

  const handleAdd = async () => {
    const result = await createLeadOwner(newName, newDepartment);
    if (!result.success) {
      toast({ title: "Could Not Add Lead Owner", description: result.message, variant: "destructive" });
      return;
    }
    setNewName("");
    setNewDepartment("");
    refresh();
    toast({ title: "Lead Owner Added" });
  };

  const startEdit = (row: LeadOwnerRow) => {
    setEditingId(row.id);
    setEditingName(row.name);
    setEditingDepartment(row.department ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingDepartment("");
  };

  const handleUpdate = async (id: string) => {
    const result = await updateLeadOwner(id, editingName, editingDepartment);
    if (!result.success) {
      toast({ title: "Could Not Update Lead Owner", description: result.message, variant: "destructive" });
      return;
    }
    cancelEdit();
    refresh();
    toast({ title: "Lead Owner Updated" });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const result = await deleteLeadOwner(deleting.id);
    if (!result.success) {
      toast({ title: "Could Not Delete Lead Owner", description: result.message, variant: "destructive" });
      return;
    }
    setLeadOwners(prev => prev.filter(l => l.id !== deleting.id));
    setDeleting(null);
    toast({ title: "Lead Owner Deleted", variant: "destructive" });
  };

  return (
    <div className="flex-1 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Lead Owners</h2>
        <p className="text-muted-foreground">
          The offices that lead plan activities, such as &ldquo;Chief Strategy Officer&rdquo;. Link each person to their office when registering or editing them under Users &amp; Roles — plan imports then match offices to people automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead Owner List</CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
              <Input
                placeholder="New lead owner, e.g. Chief Finance Officer"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="max-w-sm"
              />
              <DepartmentSelect value={newDepartment} onChange={setNewDepartment} departments={departments} />
              <Button onClick={handleAdd} disabled={!newName.trim()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Owner</TableHead>
                <TableHead>Default Department</TableHead>
                <TableHead>Held By</TableHead>
                <TableHead className="w-[140px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadOwners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    <UserCog className="mx-auto mb-2 h-6 w-6" />
                    No lead owners yet. Add them here, or they're added when you register people during a plan import.
                  </TableCell>
                </TableRow>
              )}
              {leadOwners.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {editingId === row.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(row.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="max-w-sm"
                      />
                    ) : row.name}
                  </TableCell>
                  <TableCell>
                    {editingId === row.id
                      ? <DepartmentSelect value={editingDepartment} onChange={setEditingDepartment} departments={departments} />
                      : row.department ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {row.users.length === 0
                      ? <Badge variant="outline" className="border-amber-500 text-amber-600">No one yet</Badge>
                      : <div className="flex flex-wrap gap-1">{row.users.map(u => <Badge key={u.id} variant="secondary">{u.name}</Badge>)}</div>}
                  </TableCell>
                  <TableCell className="text-center">
                    {editingId === row.id ? (
                      <>
                        <Button size="icon" variant="ghost" aria-label="Save" onClick={() => handleUpdate(row.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Cancel" onClick={cancelEdit}><X className="h-4 w-4 text-muted-foreground" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleting?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.users.length > 0
                ? `${deleting.users.map(u => u.name).join(", ")} will no longer be linked to this office. Their accounts and activities stay as they are.`
                : "Nobody holds this office, so nothing else changes."}
              {" "}Activities already in plans keep the lead owner title they were saved with.
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
