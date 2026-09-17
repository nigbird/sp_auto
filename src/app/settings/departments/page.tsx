
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getDepartments, createDepartment, deleteDepartment } from "@/actions/departments";

interface DepartmentRow {
  id: string;
  name: string;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [newName, setNewName] = useState("");
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
          <Button asChild variant="outline" size="icon">
            <Link href="/settings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
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
                <TableHead className="text-center w-[100px]">Actions</TableHead>
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
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell className="text-center">
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(department.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
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
