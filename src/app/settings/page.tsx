"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, UserPlus, Users, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-8">
      <div className="flex items-start gap-4">
        <Settings className="h-8 w-8 text-muted-foreground mt-1" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Settings</h1>
          <p className="text-lg text-muted-foreground">Manage users and other application configurations.</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>User Registration</CardTitle>
            <CardDescription>Register new users for the application. Create new accounts. New users are created without any roles by default.</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="#">
                <UserPlus className="mr-2 h-4 w-4" /> Go to User Registration
              </Link>
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage user roles and the buildings they are assigned to. Assign roles and buildings to users to control access and responsibilities.</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="#">
                <Users className="mr-2 h-4 w-4" /> Go to User Management
              </Link>
            </Button>
          </CardFooter>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Role Management</CardTitle>
            <CardDescription>Define roles and their permissions within the application. Create new roles, or edit existing ones to specify what actions users with that role can perform.</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
              <Link href="#">
                <CheckCircle className="mr-2 h-4 w-4" /> Go to Role Management
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
