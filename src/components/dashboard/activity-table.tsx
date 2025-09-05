
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
import { MoreHorizontal, PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Activity, ActivityStatus } from "@/lib/types";
import { StatusBadge } from "../status-badge";
import { Progress } from "../ui/progress";
import { ActivityForm } from "./activity-form";
import { format } from "date-fns";
import { Input } from "../ui/input";
import { DataTableFacetedFilter } from "../data-table-faceted-filter";
import { DateRangePicker } from "../date-range-picker";
import { DateRange } from "react-day-picker";

export function ActivityTable({ activities, users, departments }: { activities: Activity[], users: string[], departments: string[] }) {
  const [data, setData] = useState(activities);
  const [open, setOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const handleFormSubmit = (values: any) => {
    if(editingActivity) {
      // Update logic
      setData(data.map(act => act.id === editingActivity.id ? {...act, ...values, lastUpdated: {user: 'Admin User', date: new Date()}} : act));
    } else {
      // Create logic
      const newActivity: Activity = {
        id: `ACT-${Math.floor(Math.random() * 1000)}`,
        ...values,
        kpis: [],
        lastUpdated: { user: "Admin User", date: new Date() },
        updates: [],
        progress: 0,
        weight: 50,
      };
      setData([newActivity, ...data]);
    }
    setOpen(false);
    setEditingActivity(null);
  };
  
  const handleEdit = (activity: Activity) => {
    setEditingActivity(activity);
    setOpen(true);
  };
  
  const handleCreateNew = () => {
    setEditingActivity(null);
    setOpen(true);
  };
  
  const statuses: ActivityStatus[] = ["Not Started", "On Track", "Completed As Per Target", "Delayed", "Overdue"];
  const departmentOptions = departments.map(d => ({ label: d, value: d }));
  const statusOptions = statuses.map(s => ({ label: s, value: s }));

  const columns: ColumnDef<Activity>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("title")}</div>
      ),
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
    },
    {
      accessorKey: "endDate",
      header: "End Date",
      cell: ({ row }) => format(row.getValue("endDate"), "PPP"),
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
      accessorKey: "weight",
      header: "Weight",
       cell: ({ row }) => <div>{row.getValue("weight")}%</div>,
    },
    {
      accessorKey: "status",
      header: "Status",
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
              <DropdownMenuItem onClick={() => handleEdit(activity)}>Edit Activity</DropdownMenuItem>
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="w-full">
        <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-2">
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
                        title="Status"
                        options={statusOptions}
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
          <DialogTrigger asChild>
            <Button onClick={handleCreateNew} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Activity
            </Button>
          </DialogTrigger>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingActivity ? 'Edit Activity' : 'Create New Activity'}</DialogTitle>
        </DialogHeader>
        <ActivityForm 
          onSubmit={handleFormSubmit}
          activity={editingActivity}
          users={users}
          departments={departments}
        />
      </DialogContent>
    </Dialog>
  );
}
