
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserRegistrationPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">User Registration</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Register a New User</CardTitle>
        </CardHeader>
        <CardContent>
          <p>User registration form will be here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
