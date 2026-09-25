"use client";

import { MoreHorizontal, UserPlus, Trash2 } from "lucide-react";
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
import { getUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import { getRoles } from "@/actions/roles";
import type { User } from "@/lib/types";
import { format } from "date-fns";
import { UserForm, UserFormValues } from "@/components/settings/user-form";
import { useToast } from "@/hooks/use-toast";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

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
    try {
      await createUser({ name: values.name, email: values.email, roleId: values.roleId });
    } catch (error) {
      toast({
        title: "Could Not Register User",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
      return;
    }
    setUsers(await getUsers());
    setIsRegisterDialogOpen(false);
    toast({
      title: "User Registered",
      description: `${values.name} has been successfully registered.`,
    });
  };

  const handleUpdateUser = async (values: UserFormValues) => {
    if (!selectedUser) return;
    const roles = await getRoles();
    const roleName = roles.find((r) => r.id === values.roleId)?.name ?? selectedUser.role;
    await updateUser(selectedUser.email, { name: values.name, roleId: values.roleId });
    setUsers(users.map(user =>
        user.email === selectedUser.email ? { ...user, name: values.name, role: roleName, roleId: values.roleId } : user
    ));
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
              Register new users, and edit, deactivate or remove existing ones.
            </CardDescription>
          </div>
          <Button onClick={() => setIsRegisterDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Register User
          </Button>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
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
                   <TableCell>
                    <Badge variant={user.status === 'Active' ? 'default' : 'secondary'} className={user.status === 'Active' ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(user.createdAt), "PP")}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
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

    </div>
  );
}
