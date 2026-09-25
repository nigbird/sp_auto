"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSION_GROUPS } from "@/lib/auth/permissions";

export type RoleFormValues = { name: string; permissions: string[] };

interface RoleFormProps {
  /** The role being edited; null to create a new one. Built-in and existing roles keep their name. */
  role: { name: string; permissions: string[] } | null;
  isSaving: boolean;
  onSubmit: (values: RoleFormValues) => void;
  onCancel: () => void;
}

export function RoleForm({ role, isSaving, onSubmit, onCancel }: RoleFormProps) {
  const [name, setName] = useState(role?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (ids: string[]) => {
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), permissions: Array.from(selected) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="role-name">Role Name</Label>
        <Input
          id="role-name"
          placeholder="e.g., Department Head"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!!role}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Permissions</h3>
          <p className="text-sm text-muted-foreground">Select what users with this role are allowed to do.</p>
        </div>
        {PERMISSION_GROUPS.map((group) => {
          const ids = group.permissions.map((p) => p.id);
          const allSelected = ids.every((id) => selected.has(id));
          return (
            <Card key={group.title} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b p-3">
                <CardTitle className="text-sm">{group.title}</CardTitle>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`select-all-${group.title}`}
                    checked={allSelected}
                    onCheckedChange={() => toggleGroup(ids)}
                  />
                  <Label htmlFor={`select-all-${group.title}`} className="text-sm font-normal">
                    Select All
                  </Label>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission.id}
                      checked={selected.has(permission.id)}
                      onCheckedChange={() => toggle(permission.id)}
                    />
                    <Label htmlFor={permission.id} className="cursor-pointer text-sm font-normal">
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : role ? "Save Changes" : "Create Role"}
        </Button>
      </div>
    </form>
  );
}
