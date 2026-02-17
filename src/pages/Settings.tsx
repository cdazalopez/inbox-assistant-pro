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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAlertPreferences } from "@/hooks/useAlertPreferences";
import { User, Link2, Bell, Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import VoiceSettingsCard from "@/components/voice/VoiceSettingsCard";
import AutopilotSettingsCard from "@/components/autopilot/AutopilotSettingsCard";
import { useAutopilot } from "@/hooks/useAutopilot";

interface ConnectedAccount {
  id: string;
  email: string;
  provider: string;
  sync_status: string;
  created_at?: string;
  last_sync?: string;
  email_count?: number;
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { prefs, update } = useAlertPreferences();
  const autopilotHook = useAutopilot();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const fetchAccounts = async () => {
    if (!user?.id) return;
    try {
      const data = await awsApi.getAccounts(user.id);
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      console.error("Failed to fetch accounts");
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [user?.id]);

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast({ title: "Email account connected successfully!" });
      setSearchParams({}, { replace: true });
      fetchAccounts();
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

  const handleSyncAccount = async (accountId: string) => {
    if (!user?.id) return;
    setSyncingAccountId(accountId);
    try {
      const result = await awsApi.syncEmails(user.id, accountId);
      const count = result?.new_emails ?? result?.synced ?? 0;
      toast({ title: `Synced ${count} new email${count !== 1 ? "s" : ""}` });
      fetchAccounts();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!user?.id) return;
    setSyncingAll(true);
    try {
      const result = await awsApi.syncEmails(user.id);
      const results = result?.results;
      if (Array.isArray(results)) {
        const parts = results.map((r: any) => `${r.new_emails ?? 0} new from ${r.provider ?? 'account'}`);
        toast({ title: `Synced ${accounts.length} accounts: ${parts.join(', ')}` });
      } else {
        const count = result?.new_emails ?? result?.synced ?? 0;
        toast({ title: `Synced ${count} new email${count !== 1 ? "s" : ""}` });
      }
      fetchAccounts();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setSyncingAll(false);
    }
  };

  const ProviderIcon = ({ provider }: { provider: string }) =>
    provider === "google" ? (
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ) : (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="hsl(var(--primary))">
        <path d="M1 1h10v10H1V1zm12 0h10v10H13V1zM1 13h10v10H1V13zm12 0h10v10H13V13z" />
      </svg>
    );

  const thresholdOptions: { value: 3 | 4 | 5; label: string }[] = [
    { value: 3, label: "3+ (Medium and above)" },
    { value: 4, label: "4+ (High and above)" },
    { value: 5, label: "5 only (Critical only)" },
  ];

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <CardTitle>Connected Accounts</CardTitle>
            </div>
            {accounts.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncingAll}
              >
                {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync All
              </Button>
            )}
          </div>
          <CardDescription>Connect your email accounts to start managing your inbox</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4"
                >
                  <ProviderIcon provider={account.provider} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{account.email}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {account.created_at && (
                        <span>Connected {new Date(account.created_at).toLocaleDateString()}</span>
                      )}
                      {account.last_sync && (
                        <>
                          <span>·</span>
                          <span>Last sync: {new Date(account.last_sync).toLocaleString()}</span>
                        </>
                      )}
                      {account.email_count !== undefined && (
                        <>
                          <span>·</span>
                          <span>{account.email_count} emails</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSyncAccount(account.id)}
                    disabled={syncingAccountId === account.id}
                  >
                    {syncingAccountId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Badge
                    variant={account.sync_status === "active" ? "default" : "secondary"}
                    className={
                      account.sync_status === "active"
                        ? "bg-green-600 hover:bg-green-600 text-white"
                        : "bg-yellow-600 hover:bg-yellow-600 text-white"
                    }
                  >
                    {account.sync_status === "active" ? "Active" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : null}

          <Separator />
          <p className="text-sm font-medium text-foreground">
            {accounts.length > 0 ? "Connect Another Account" : "Connect Your Email"}
          </p>
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

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <CardTitle>Alert Preferences</CardTitle>
          </div>
          <CardDescription>Configure how urgent email alerts are displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Toast notifications for urgent emails</Label>
              <p className="text-xs text-muted-foreground">Show popup alerts for high urgency emails</p>
            </div>
            <Switch
              checked={prefs.showUrgentToasts}
              onCheckedChange={(v) => update({ showUrgentToasts: v })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Toast notifications for risk flags</Label>
              <p className="text-xs text-muted-foreground">Show alerts for legal threats, payment issues, etc.</p>
            </div>
            <Switch
              checked={prefs.showRiskFlagToasts}
              onCheckedChange={(v) => update({ showRiskFlagToasts: v })}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Alert urgency threshold</Label>
            <p className="text-xs text-muted-foreground">Minimum urgency level to trigger alerts</p>
            <div className="flex gap-2 pt-1">
              {thresholdOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ urgencyThreshold: opt.value })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    prefs.urgencyThreshold === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autopilot Preferences */}
      <AutopilotSettingsCard prefs={autopilotHook.prefs} updatePrefs={autopilotHook.updatePrefs} />

      {/* Voice Briefing */}
      <VoiceSettingsCard />

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
