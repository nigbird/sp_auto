"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateMyName, changeMyPassword } from "@/actions/profile";
import { checkPasswordStrength, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        className={invalid ? "border-destructive pr-10" : "pr-10"}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function ProfileCard({ name: initialName, details }: { name: string; details: { label: string; value: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const changed = name.trim() !== initialName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateMyName(name);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setError(null);
      toast({ title: "Profile updated" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Avatar className="h-14 w-14 text-lg">
          <AvatarFallback>{initials(initialName)}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{initialName}</CardTitle>
          <CardDescription>{details.find(d => d.label === "Role")?.value}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Label htmlFor="profile-name">Full name</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="profile-name" value={name} maxLength={100} onChange={e => { setName(e.target.value); setError(null); }} className={error ? "border-destructive" : undefined} />
            <Button type="submit" disabled={!changed || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </form>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {details.map(d => (
            <div key={d.label}>
              <dt className="text-xs text-muted-foreground">{d.label}</dt>
              <dd className="text-sm font-medium break-words">{d.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">Email and role are managed by an administrator.</p>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Enter your current password.";
    const weakness = checkPasswordStrength(next);
    if (weakness) found.next = weakness;
    else if (next === current) found.next = "Choose a password different from your current one.";
    if (confirm !== next) found.confirm = "Passwords don't match.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const result = await changeMyPassword(current, next);
      if (!result.success) {
        if (result.field === "currentPassword") setErrors({ current: result.message });
        else if (result.field === "newPassword") setErrors({ next: result.message });
        else setErrors({ form: result.message });
        return;
      }
      toast({ title: "Password changed", description: "Sign in again with your new password." });
      router.replace("/login?password=changed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>You'll be signed out on all devices afterwards.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput id="current-password" value={current} onChange={v => { setCurrent(v); setErrors(({ current: _, ...rest }) => rest); }} autoComplete="current-password" invalid={!!errors.current} />
            {errors.current && <p className="text-sm font-medium text-destructive">{errors.current}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput id="new-password" value={next} onChange={v => { setNext(v); setErrors(({ next: _, ...rest }) => rest); }} autoComplete="new-password" invalid={!!errors.next} />
            {errors.next
              ? <p className="text-sm font-medium text-destructive">{errors.next}</p>
              : <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters, with a letter and a number.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput id="confirm-password" value={confirm} onChange={v => { setConfirm(v); setErrors(({ confirm: _, ...rest }) => rest); }} autoComplete="new-password" invalid={!!errors.confirm} />
            {errors.confirm && <p className="text-sm font-medium text-destructive">{errors.confirm}</p>}
          </div>
          {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ProfileForms({ name, details }: { name: string; details: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard name={name} details={details} />
      <PasswordCard />
    </div>
  );
}
