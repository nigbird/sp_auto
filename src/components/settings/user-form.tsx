"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { getRoles } from "@/actions/roles";
import { getLeadOwners } from "@/actions/lead-owners";
import { getDepartments } from "@/actions/departments";

const NONE = "__none__";

const formSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  roleId: z.string({ required_error: "You need to select a role." }).min(1, "You need to select a role."),
  leadOwnerId: z.string().optional(),
  department: z.string().optional(),
});

export type UserFormValues = z.infer<typeof formSchema>;

interface UserFormProps {
  user: User | null;
  /** Return false to keep the form open (e.g. the server rejected it). */
  onSubmit: (values: UserFormValues) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
  /** Values to start a new user with (e.g. an office found in an imported plan). */
  initialValues?: Partial<UserFormValues>;
  /** Show the lead owner as fixed text instead of a picker (used when registering the holder of a specific office). */
  fixedLeadOwnerName?: string;
  submitLabel?: string;
}

/**
 * Register or edit a user. Lead owner and department are optional, but the
 * form always shows a confirmation of both before saving — calling out a
 * missing one — since they decide which plan activities and requests the
 * person receives.
 */
export function UserForm({ user, onSubmit, onCancel, initialValues, fixedLeadOwnerName, submitLabel }: UserFormProps) {
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [leadOwners, setLeadOwners] = useState<{ id: string; name: string; department: string | null }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [pending, setPending] = useState<UserFormValues | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getRoles().then(setRoles);
    getLeadOwners().then(setLeadOwners);
    getDepartments().then(list => setDepartments(list.map(d => d.name)));
  }, []);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      roleId: "",
      leadOwnerId: "",
      department: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        leadOwnerId: user.leadOwnerId ?? "",
        department: user.department ?? "",
      });
    }
  }, [user, form]);

  const leadOwnerName = fixedLeadOwnerName ?? leadOwners.find(l => l.id === pending?.leadOwnerId)?.name;
  const missing = pending ? [!leadOwnerName && "lead owner", !pending.department && "department"].filter(Boolean) as string[] : [];

  const confirm = async () => {
    if (!pending) return;
    setIsSaving(true);
    try {
      const saved = await onSubmit(pending);
      if (saved !== false) setPending(null);
    } finally {
      setIsSaving(false);
    }
  };

  // A department that isn't on the list yet (e.g. suggested from an imported plan) still shows as an option.
  const departmentOptions = Array.from(new Set([...departments, form.watch("department") || ""].filter(Boolean))).sort();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(values => setPending(values))} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} disabled={!!user} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="roleId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fixedLeadOwnerName ? (
            <FormItem>
              <FormLabel>Lead Owner</FormLabel>
              <div className="flex min-h-10 items-center rounded-md border bg-muted/50 px-3 py-2 text-sm">{fixedLeadOwnerName}</div>
              <FormDescription>From the plan. Added to the lead owner list if it's new.</FormDescription>
            </FormItem>
          ) : (
            <FormField
              control={form.control}
              name="leadOwnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Owner <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <Select
                    value={field.value || NONE}
                    onValueChange={(v) => {
                      const id = v === NONE ? "" : v;
                      field.onChange(id);
                      // Fill in the office's usual department when none is chosen yet.
                      const office = leadOwners.find(l => l.id === id);
                      if (office?.department && !form.getValues("department")) form.setValue("department", office.department);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {leadOwners.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormDescription>The office they hold, e.g. Chief Strategy Officer. Manage the list in Configuration → Departments & Lead Owners.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {departmentOptions.map(d => <SelectItem key={d} value={d}>{d}{!departments.includes(d) ? " (new)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
            </Button>
            <Button type="submit">{submitLabel ?? (user ? "Save Changes" : "Register User")}</Button>
        </div>
      </form>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open && !isSaving) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{user ? "Save these details?" : "Register this user?"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-foreground">
                  <dt className="text-muted-foreground">Name</dt><dd>{pending?.name}</dd>
                  <dt className="text-muted-foreground">Email</dt><dd>{pending?.email}</dd>
                  <dt className="text-muted-foreground">Role</dt><dd>{roles.find(r => r.id === pending?.roleId)?.name}</dd>
                  <dt className="text-muted-foreground">Lead owner</dt><dd className={!leadOwnerName ? "text-amber-600" : ""}>{leadOwnerName || "None"}</dd>
                  <dt className="text-muted-foreground">Department</dt><dd className={!pending?.department ? "text-amber-600" : ""}>{pending?.department || "None"}</dd>
                </dl>
                {missing.length > 0 && (
                  <p className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>No {missing.join(" or ")} is selected. Plan imports and lead-owner matching can't find this person by office until one is set — you can add it later from the user list.</span>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Go back</AlertDialogCancel>
            <Button onClick={confirm} disabled={isSaving}>{missing.length > 0 ? "Save anyway" : "Confirm"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Form>
  );
}
