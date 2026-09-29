"use client";

import { usePermissions } from "@/components/permissions-provider";
import { MoreHorizontal, UserPlus, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { getUsers, createUser, updateUser, deleteUser, resendInvite, type InviteOutcome } from "@/actions/users";
import type { User } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { UserForm, UserFormValues } from "@/components/settings/user-form";
import { InviteLinkDialog } from "@/components/settings/invite-link-dialog";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter, ListToolbar, Pagination, SearchBox, usePagination } from "@/components/list-controls";
import { inDateRange, isRangeSet, matchesSearch, type DateRangeValue } from "@/lib/list-filters";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [manualInvite, setManualInvite] = useState<{ name: string; email: string; link: string } | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast } = useToast();
  const canManage = usePermissions().can("users:manage");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRangeValue>({});
  const narrowed = query.trim() !== "" || isRangeSet(range);
  const matchingUsers = users.filter(u =>
    inDateRange(u.createdAt, range) &&
    matchesSearch(query, u.name, u.email, u.role, u.leadOwner, u.department, u.status));
  const userPages = usePagination(matchingUsers, `${query}|${range.from}|${range.to}`);

  /** Tells the admin the invite went out, or hands them the link when it couldn't be emailed. */
  const reportInvite = (user: { name: string; email: string }, invite: InviteOutcome, verb: string) => {
    if (invite.emailed) {
      toast({ title: `Invitation ${verb}`, description: `${user.name} has been emailed a link to set their password.` });
    } else if (invite.link) {
      setManualInvite({ name: user.name, email: user.email, link: invite.link });
    }
  };

  const handleResendInvite = async (user: User) => {
    setResendingId(user.id);
    try {
      const result = await resendInvite(user.id);
      if (!result.success) {
        toast({ title: "Could Not Resend Invitation", description: result.message, variant: "destructive" });
        return;
      }
      setUsers(await getUsers());
      reportInvite(user, result.invite, "resent");
    } finally {
      setResendingId(null);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const userList = await getUsers();
      setUsers(userList);
      setIsLoading(false);
    }
    fetchData();
  }, []);

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    await updateUser(user.email, { status: newStatus });
    setUsers(users.map(u => u.email === user.email ? { ...u, status: newStatus } : u));
    toast({
        title: "Status Updated",
        description: `${user.name}'s status has been updated to ${newStatus}.`,
    });
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };
  
  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleRegisterUser = async (values: UserFormValues) => {
    const result = await createUser({
      name: values.name,
      email: values.email,
      roleId: values.roleId,
      leadOwnerId: values.leadOwnerId || null,
      department: values.department || null,
    });
    if (!result.success) {
      toast({ title: "Could Not Register User", description: result.message, variant: "destructive" });
      return;
    }
    setUsers(await getUsers());
    setIsRegisterDialogOpen(false);
    if (result.invite.emailed) {
      toast({
        title: "User Registered",
        description: `${values.name} has been registered and emailed a link to set their password.`,
      });
    } else {
      reportInvite(result.user, result.invite, "created");
    }
  };

  const handleUpdateUser = async (values: UserFormValues) => {
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.email, {
        name: values.name,
        roleId: values.roleId,
        leadOwnerId: values.leadOwnerId || null,
        department: values.department || null,
      });
    } catch (error) {
      toast({ title: "Could Not Update User", description: error instanceof Error ? error.message : "An unexpected error occurred.", variant: "destructive" });
      return;
    }
    setUsers(await getUsers());
    setIsEditDialogOpen(false);
    setSelectedUser(null);
    toast({
      title: "User Updated",
      description: `${values.name}'s details have been successfully updated.`,
    });
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    await deleteUser(selectedUser.email);
    setUsers(users.filter(user => user.email !== selectedUser.email));
    setIsDeleteDialogOpen(false);
    setSelectedUser(null);
    toast({
      title: "User Deleted",
      description: "The user has been permanently removed from the system.",
      variant: "destructive",
    });
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Everyone who can sign in.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setIsRegisterDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Register User
          </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <ListToolbar count={narrowed ? `${matchingUsers.length} of ${users.length} users match` : `${users.length} users`}>
            <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, role, lead owner or department" className="sm:w-96" />
            <DateRangeFilter value={range} onChange={setRange} label="Any creation date" hint="Shows users created in this range." />
            {narrowed && <Button variant="ghost" className="h-10 px-3" onClick={() => { setQuery(""); setRange({}); }}>Reset</Button>}
          </ListToolbar>
          <div className="overflow-x-auto rounded-md border">
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Lead Owner</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : matchingUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {narrowed ? "No users match the search or dates." : "No users yet."}
                  </TableCell>
                </TableRow>
              ) : (
                userPages.items.map((user) => (
                <TableRow key={user.email}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="person" />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                    </TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="max-w-[220px]">{user.leadOwner ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{user.department ?? <span className="text-muted-foreground">—</span>}</TableCell>
                   <TableCell>
                    <Badge variant={user.status === 'Active' ? 'default' : 'secondary'} className={user.status === 'Active' ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>
                      {user.status}
                    </Badge>
                    <InviteStatus user={user} />
                  </TableCell>
                  <TableCell>{format(new Date(user.createdAt), "PP")}</TableCell>
                  <TableCell>
                    {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(user)}>
                            Edit
                        </DropdownMenuItem>
                        {user.invitePending && (
                          <DropdownMenuItem onClick={() => handleResendInvite(user)} disabled={resendingId === user.id}>
                            <Mail className="mr-2 h-4 w-4" />
                            {resendingId === user.id ? "Sending…" : "Resend invitation"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                          {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(user)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          </div>
          {!isLoading && <Pagination state={userPages} noun="users" />}
        </CardContent>
      </Card>

      {/* Register User Dialog */}
      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register User</DialogTitle>
            <DialogDescription>
              Create a new user account and assign its role.
            </DialogDescription>
          </DialogHeader>
          {isRegisterDialogOpen && (
            <UserForm
              user={null}
              onSubmit={handleRegisterUser}
              onCancel={() => setIsRegisterDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
                Update the details for {selectedUser?.name}.
            </DialogDescription>
          </DialogHeader>
          <UserForm 
            user={selectedUser}
            onSubmit={handleUpdateUser}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete User Confirmation */}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the account for <strong>{selectedUser?.name}</strong>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedUser(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InviteLinkDialog invite={manualInvite} onClose={() => setManualInvite(null)} />
    </div>
  );
}

/** Under the status badge, until the person first signs in: whether their invitation is still usable. */
function InviteStatus({ user }: { user: User }) {
  if (!user.invitePending) return null;
  if (!user.inviteSentAt || !user.inviteExpiresAt) {
    return <p className="mt-1 text-xs text-muted-foreground">Never signed in</p>;
  }
  const expired = new Date(user.inviteExpiresAt).getTime() < Date.now();
  return (
    <p
      className={expired ? "mt-1 text-xs text-amber-600" : "mt-1 text-xs text-muted-foreground"}
      title={`Invitation sent ${format(new Date(user.inviteSentAt), "PPp")}`}
    >
      {expired
        ? "Invite expired — resend"
        : `Invite sent ${formatDistanceToNow(new Date(user.inviteSentAt), { addSuffix: true })}`}
    </p>
  );
}
