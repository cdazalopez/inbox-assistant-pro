import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Link2, Bell } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input defaultValue={user?.user_metadata?.full_name ?? ""} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input defaultValue="UTC" />
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            <CardTitle>Connected Accounts</CardTitle>
          </div>
          <CardDescription>Manage your connected services</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Configure how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["Email notifications", "Push notifications", "Weekly digest"].map((label, i) => (
            <div key={i}>
              {i > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
