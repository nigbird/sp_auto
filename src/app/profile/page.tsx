import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { ProfileForms } from "@/components/profile/profile-forms";

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      department: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { name: true } },
      leadOwner: { select: { name: true } },
    },
  });

  const details = [
    { label: "Email", value: user.email },
    { label: "Role", value: user.role.name },
    { label: "Office", value: user.leadOwner?.name },
    { label: "Department", value: user.department },
    { label: "Member since", value: format(user.createdAt, "PP") },
    { label: "Last sign-in", value: user.lastLoginAt ? format(user.lastLoginAt, "PPp") : null },
  ].filter((d): d is { label: string; value: string } => !!d.value);

  return (
    <div className="flex-1 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Your account details and password.</p>
      </div>
      <ProfileForms name={user.name} details={details} />
    </div>
  );
}
