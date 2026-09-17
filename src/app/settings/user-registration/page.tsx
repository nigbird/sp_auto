
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createUser } from "@/actions/users";
import { getRoles } from "@/actions/roles";
import { useRouter } from "next/navigation";


export default function UserRegistrationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [leadOwner, setLeadOwner] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getRoles().then(setRoles);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) {
        toast({ title: "Error", description: "Please select a role.", variant: "destructive"});
        return;
    }
    await createUser({ name: leadOwner, email: email, roleId });
    toast({
      title: "User Registered",
      description: `User ${leadOwner} has been successfully registered.`,
    });
    router.push('/settings/user-management');
  };

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Registration</h1>
          <p className="text-muted-foreground">Create a new user account.</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New User Details</CardTitle>
          <CardDescription>
            Fill out the form below to register a new user. A temporary password will be generated from their email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
                <Label htmlFor="lead-owner">Lead/Owner</Label>
                <Input id="lead-owner" placeholder="John Doe" value={leadOwner} onChange={e => setLeadOwner(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input id="phone-number" placeholder="0912345678" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register User
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
