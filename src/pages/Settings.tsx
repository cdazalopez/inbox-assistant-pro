import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Link2, Bell, Mail, Loader2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast({ title: "Email account connected successfully!" });
      setSearchParams({}, { replace: true });
    }
    const error = searchParams.get("error");
    if (error) {
      toast({ title: "Connection failed", description: decodeURIComponent(error), variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, toast, setSearchParams]);

  const handleConnect = async (provider: 'google' | 'microsoft') => {
    if (!user?.id) return;
    setConnectingProvider(provider);
    try {
      const data = await awsApi.connectEmail(user.id, provider);
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast({ title: "Connection failed", description: "No auth URL returned", variant: "destructive" });
      }
    } catch {
      toast({ title: "Connection failed", description: "Could not reach the server", variant: "destructive" });
    } finally {
      setConnectingProvider(null);
    }
  };

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
          <CardDescription>Connect your email accounts to start managing your inbox</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto flex-col gap-3 border-border bg-white px-6 py-6 text-gray-800 hover:bg-gray-50"
              onClick={() => handleConnect('google')}
              disabled={connectingProvider !== null}
            >
              {connectingProvider === 'google' ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <svg className="h-8 w-8" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              <span className="text-sm font-medium">Connect Gmail</span>
            </Button>

            <Button
              variant="outline"
              className="h-auto flex-col gap-3 border-border px-6 py-6 text-white hover:opacity-90"
              style={{ backgroundColor: '#0078D4' }}
              onClick={() => handleConnect('microsoft')}
              disabled={connectingProvider !== null}
            >
              {connectingProvider === 'microsoft' ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
              ) : (
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="white">
                  <path d="M1 1h10v10H1V1zm12 0h10v10H13V1zM1 13h10v10H1V13zm12 0h10v10H13V13z" />
                </svg>
              )}
              <span className="text-sm font-medium">Connect Outlook</span>
            </Button>
          </div>
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
