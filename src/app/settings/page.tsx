
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Settings Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This is the settings page. Content will be added here soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
