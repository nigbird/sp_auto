
"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  ColumnFiltersState,
  getFilteredRowModel,
} from "@tanstack/react-table";
import { MoreHorizontal, PlusCircle, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Activity, User } from "@/lib/types";
import type { ApprovalStatus } from "@prisma/client";
import { StatusBadge } from "../status-badge";
import { updateActivity } from "@/actions/activities";
import { Progress } from "../ui/progress";
import { ActivityForm } from "./activity-form";
import { ActivityDetailsDialog } from "./activity-details-dialog";
import { format } from "date-fns";
import { Input } from "../ui/input";
import { DataTableFacetedFilter } from "../data-table-faceted-filter";
import { DateRangePicker } from "../date-range-picker";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { calculateActivityStatus } from "@/lib/utils";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";

const ApprovalStatusBadge = ({ status }: { status: Activity['approvalStatus'] }) => {
  if (!status) return null;
  const variant = status === 'APPROVED' ? 'default' : status === 'DECLINED' ? 'destructive' : 'secondary';
  const className = status === 'APPROVED' ? 'bg-green-500/20 text-green-700 border-green-400' : status === 'DECLINED' ? 'bg-red-500/20 text-red-700 border-red-400' : '';
  return <Badge variant={variant} className={className}>{status}</Badge>
}

export function ActivityTable({ activities, users, departments, statuses }: { activities: Activity[], users: User[], departments: string[], statuses: string[] }) {
  const [data, setData] = useState(activities);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Accept users as User[] instead of string[]
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const { toast } = useToast();

  const handleFormSubmit = (values: any) => {
    if(editingActivity) {
      // Update logic
      const updatedActivity = {
        ...editingActivity, 
        ...values, 
        updatedAt: new Date()
      };
      setData(data.map(act => act.id === editingActivity.id ? updatedActivity : act));
      toast({ title: "Activity Updated", description: "The activity details have been updated." });
    } else {
      // Create logic
      const newActivity: Activity = {
        id: `ACT-${Math.floor(Math.random() * 1000)}`,
        ...values,
        kpis: [],
        updatedAt: new Date(),
        updates: [],
        progress: 0,
        approvalStatus: 'PENDING',
      };
      setData([newActivity, ...data]);
      toast({ title: "Activity Created", description: "The new activity has been submitted for approval." });
    }
    setIsCreateFormOpen(false);
    setEditingActivity(null);
  };
  
  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setIsCreateFormOpen(true);
  };

  const handleViewDetails = (activity: Activity) => {
    setViewingActivity(activity);
    setIsDetailsOpen(true);
  }
  
  const handleCreateNew = () => {
    setEditingActivity(null);
    setIsCreateFormOpen(true);
  };

  const handleDeleteClick = (activity: Activity) => {
    setDeletingActivity(activity);
    setIsDeleteDialogOpen(true);
  }

  const handleDeleteConfirm = () => {
    if(!deletingActivity) return;
    setData(data.filter(act => act.id !== deletingActivity.id));
    toast({ title: "Activity Deleted", description: `"${deletingActivity.title}" has been deleted.` });
    setIsDeleteDialogOpen(false);
    setDeletingActivity(null);
  }
  
  const handleApprove = async (activityId: string) => {
    // Call backend to update approvalStatus
    await updateActivity(activityId, { approvalStatus: 'APPROVED' });
    setData(currentData => currentData.map(act => {
      if (act.id === activityId) {
        const isNewActivity = !act.pendingUpdate;
        let updatedActivity;
        if (isNewActivity) {
           toast({
              title: "Activity Approved",
              description: `The activity \"${act.title}\" has been approved.`,
            });
           updatedActivity = { ...act, approvalStatus: 'APPROVED' as ApprovalStatus };
        } else if (typeof act.pendingUpdate === 'object' && act.pendingUpdate !== null) {
            const { progress, comment, user, date } = act.pendingUpdate as any;
            const newStatus = calculateActivityStatus({ ...act, progress });
            toast({
              title: "Update Approved",
              description: `Progress for \"${act.title}\" has been updated to ${progress}%.`,
            });
            updatedActivity = {
              ...act,
              progress: progress,
              status: newStatus,
              updatedAt: date,
              updates: [...act.updates, { user, date, comment }],
              pendingUpdate: null,
              approvalStatus: 'APPROVED' as ApprovalStatus,
              declineReason: null,
            };
        } else {
           updatedActivity = { ...act, approvalStatus: 'APPROVED' as ApprovalStatus };
        }
        setViewingActivity(updatedActivity);
        return updatedActivity;
      }
      return act;
    }));
    setIsDetailsOpen(false);
  };

  const handleDeclineClick = (activityId: string) => {
    const activityToDecline = data.find(a => a.id === activityId);
    setViewingActivity(activityToDecline || null);
    setIsDetailsOpen(false);
    setIsDeclineModalOpen(true);
  }

  const confirmDecline = async () => {
    if (!viewingActivity || declineReason.trim() === "") {
        toast({ title: "Reason Required", description: "Please provide a reason for declining.", variant: "destructive" });
        return;
    }
    const activityId = viewingActivity.id;

    // Call backend to update approvalStatus
    await updateActivity(activityId, { approvalStatus: 'DECLINED', declineReason });
    setData(currentData => currentData.map(act => {
      if (act.id === activityId) {
        const isNewActivity = !act.pendingUpdate;
        let updatedActivity;
        if (isNewActivity) {
            toast({
              title: "Activity Declined",
              description: `The activity \"${act.title}\" has been declined.`,
              variant: "destructive"
            });
      updatedActivity = { 
        ...act, 
        approvalStatus: 'DECLINED' as ApprovalStatus,
        declineReason: declineReason,
      };
        } else if (typeof act.pendingUpdate === 'object' && act.pendingUpdate !== null) {
            toast({
              title: "Update Declined",
              description: `The pending update for \"${act.title}\" has been declined.`,
              variant: "destructive"
            });
      updatedActivity = { 
        ...act, 
        pendingUpdate: null, 
        approvalStatus: 'DECLINED' as ApprovalStatus,
        declineReason: declineReason,
      };
        } else {
           updatedActivity = { ...act, approvalStatus: 'DECLINED' as ApprovalStatus, declineReason: declineReason };
        }
        setViewingActivity(updatedActivity);
        return updatedActivity;
      }
      return act;
    }));
    setIsDeclineModalOpen(false);
    setDeclineReason("");
  }
  
  const handleResetForApproval = (activityId: string) => {
    setData(currentData => currentData.map(act => {
      if (act.id === activityId) {
        toast({
          title: "Activity Reset",
          description: `"${act.title}" is now ready for a new submission.`,
        });
        const updatedActivity = { 
          ...act, 
          approvalStatus: 'PENDING' as ApprovalStatus,
          declineReason: null,
        };
  setEditingActivity(updatedActivity);
        setIsCreateFormOpen(true);
        return updatedActivity;
      }
      return act;
    }));
    // We don't close the form here, we open it for editing
  };


  const departmentOptions = departments.map(d => ({ label: d, value: d }));
  const statusOptions = statuses.map(s => ({ label: s, value: s }));

  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const activity = row.original;
  const needsAttention = activity.approvalStatus === 'PENDING';
        return (
          <div className="flex items-center gap-2">
            {needsAttention && <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Needs review"></span>}
            <span className="font-medium">{row.getValue("title")}</span>
          </div>
        )
      },
    },
    {
        accessorKey: "approvalStatus",
        header: "Approval",
        cell: ({ row }) => <ApprovalStatusBadge status={row.getValue("approvalStatus")} />,
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
        }
    },
    {
      accessorKey: "department",
      header: "Department",
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "responsible",
      header: "Responsible",
      cell: ({ row }) => {
        const responsible = row.getValue("responsible") as User;
        return responsible?.name || 'N/A';
      }
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => format(new Date(row.getValue("endDate")), "PPP"),
      filterFn: (row, id, value) => {
        const date = new Date(row.getValue(id));
        const { from, to } = value as DateRange;
        if (from && !to) {
          return date >= from;
        } else if (from && to) {
          return date >= from && date <= to;
        }
        return true;
      }
    },
    {
      accessorKey: "status",
      header: "Progress Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = row.getValue("progress") as number;
        return <Progress value={progress} className="h-2" />;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const activity = row.original;
        let detailsText = 'View Details';
    if (activity.approvalStatus === 'PENDING') {
      detailsText = activity.pendingUpdate ? 'Review Progress Update' : 'Review New Activity';
    }
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleViewDetails(activity)}>
                {detailsText}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(activity)}>Edit Activity</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeleteClick(activity)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const isFiltered = table.getState().columnFilters.length > 0
  const approvalStatusOptions = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Declined', value: 'DECLINED' },
  ];

  return (
    <div>
      <div className="w-full">
        <div className="flex items-center justify-between pb-4">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    placeholder="Filter activities by title..."
                    value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
                    onChange={(event) =>
                    table.getColumn("title")?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm"
                />
                {table.getColumn("department") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("department")}
                        title="Department"
                        options={departmentOptions}
                    />
                )}
                 {table.getColumn("status") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("status")}
                        title="Progress Status"
                        options={statusOptions}
                    />
                )}
                {table.getColumn("approvalStatus") && (
                    <DataTableFacetedFilter
                        column={table.getColumn("approvalStatus")}
                        title="Approval"
                        options={approvalStatusOptions}
                    />
                )}
                {table.getColumn("endDate") && (
                  <DateRangePicker
                    onUpdate={(value) => table.getColumn("endDate")?.setFilterValue(value)}
                    initialDateFrom={new Date()}
                    align="start"
                    locale="en-GB"
                    showCompare={false}
                  />
                )}
                {isFiltered && (
                    <Button
                    variant="ghost"
                    onClick={() => table.resetColumnFilters()}
                    className="h-9 px-2 lg:px-3"
                    >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>
             <Dialog open={isCreateFormOpen} onOpenChange={setIsCreateFormOpen}>
                <DialogTrigger asChild>
                    <Button onClick={handleCreateNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Activity
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                    <DialogTitle>{editingActivity ? 'Edit Activity' : 'Create New Activity'}</DialogTitle>
                    </DialogHeader>
                    <ActivityForm 
                        onSubmit={handleFormSubmit}
                        activity={editingActivity}
                        users={users}
                        departments={departments}
                        statuses={statuses}
                        onReset={handleResetForApproval}
                        onCancel={() => { setIsCreateFormOpen(false); setEditingActivity(null); }}
                    />
                </DialogContent>
            </Dialog>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      <ActivityDetailsDialog 
        isOpen={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        activity={viewingActivity}
        onApprove={handleApprove}
        onDecline={handleDeclineClick}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the activity
                    "{deletingActivity?.title}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <AlertDialog open={isDeclineModalOpen} onOpenChange={setIsDeclineModalOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Decline</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please provide a reason for declining this update. This reason will be saved.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Type your reason here..."
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                    />
                </div>
                 <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsDeclineModalOpen(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDecline} className="bg-destructive hover:bg-destructive/90">Confirm Decline</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
