
"use client";

import { useState, useEffect } from "react";
import { Building2, Check, Pencil, PlusCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "@/actions/departments";

interface DepartmentRow {
  id: string;
  name: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();

  const refresh = () => {
    getDepartments().then(setDepartments);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await createDepartment(newName);
      setNewName("");
      refresh();
      toast({ title: "Department Added" });
    } catch (error) {
      toast({
        title: "Could Not Add Department",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (department: DepartmentRow) => {
    setEditingId(department.id);
    setEditingName(department.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      await updateDepartment(id, editingName);
      cancelEdit();
      refresh();
      toast({ title: "Department Updated" });
    } catch (error) {
      toast({
        title: "Could Not Update Department",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDepartment(id);
      setDepartments((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Department Deleted", variant: "destructive" });
    } catch (error) {
      toast({
        title: "Could Not Delete Department",
        description: error instanceof Error ? error.message : "It may still be in use.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Departments</h2>
            <p className="text-muted-foreground">
              Manage the approved department list. Activities can only be assigned to a department on this list.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department List</CardTitle>
          <CardDescription>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="New department name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="max-w-xs"
              />
              <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-center w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                    <Building2 className="mx-auto mb-2 h-6 w-6" />
                    No departments defined yet.
                  </TableCell>
                </TableRow>
              )}
              {departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">
                    {editingId === department.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUpdate(department.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="max-w-xs"
                      />
                    ) : (
                      department.name
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {editingId === department.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => handleUpdate(department.id)}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEdit}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(department)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(department.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
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
