
import Link from 'next/link';
import { listStrategicPlans } from '@/actions/strategic-plan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export default async function StrategicPlanListPage() {
  const plans = await listStrategicPlans();

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategic Plans</h1>
          <p className="text-muted-foreground">Manage all strategic plans for the organization.</p>
        </div>
        <Button asChild>
          <Link href="/strategic-plan/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Plan
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Plans</CardTitle>
          <CardDescription>Select a plan to view its details or create a new one.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length > 0 ? (
                plans.map(plan => (
                  <TableRow key={plan.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                        <Link href={`/strategic-plan/${plan.id}`} className="hover:underline">
                            {plan.name}
                        </Link>
                    </TableCell>
                    <TableCell>{plan.version}</TableCell>
                    <TableCell>{plan.startYear} - {plan.endYear}</TableCell>
                    <TableCell>
                        <Badge variant={plan.status === 'PUBLISHED' ? 'default' : 'secondary'} className={plan.status === 'PUBLISHED' ? 'bg-green-500/20 text-green-700 border-green-400' : ''}>
                            {plan.status}
                        </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(plan.updatedAt), 'PP')}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No strategic plans found. Get started by creating one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
