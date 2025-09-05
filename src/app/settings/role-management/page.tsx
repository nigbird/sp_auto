
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RoleManagementPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Manage Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Role management table and controls will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
