import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ContactProfilePanel from "@/components/contacts/ContactProfilePanel";
import {
  ContactListItem,
  getInitials,
  getAvatarColor,
  getSentimentDotColor,
} from "@/components/contacts/types";
import { Search, Users, Mail } from "lucide-react";
import { format } from "date-fns";

type SortKey = "email_count" | "last_email" | "name";

export default function Contacts() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ContactListItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("email_count");
  const [expandedEmail, setExpandedEmail] = useState<string | null>(
    searchParams.get("email") || null
  );

  useEffect(() => {
    if (!user?.id) return;
    awsApi.getContactsList(user.id, 100).then(setContacts).catch(() => setContacts([]));
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!contacts) return null;
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) => c.name?.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      if (sort === "email_count") return b.email_count - a.email_count;
      if (sort === "last_email") return new Date(b.last_email).getTime() - new Date(a.last_email).getTime();
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
    return result;
  }, [contacts, search, sort]);

  const top5 = useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => b.email_count - a.email_count).slice(0, 5);
  }, [contacts]);

  const handleExpand = useCallback((email: string) => {
    setExpandedEmail((prev) => (prev === email ? null : email));
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contacts ? `${contacts.length} contacts` : "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email_count">Most Active</SelectItem>
              <SelectItem value="last_email">Most Recent</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Contacts */}
      {!search && top5.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Top Contacts</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {top5.map((c) => {
              const initials = getInitials(c.name || c.email);
              const color = getAvatarColor(c.name || c.email);
              return (
                <button
                  key={c.email}
                  onClick={() => handleExpand(c.email)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors hover:bg-muted/30 ${
                    expandedEmail === c.email ? "border-primary bg-muted/30" : "border-border bg-card"
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${color}`}>
                    {initials}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate max-w-full">{c.name || c.email.split("@")[0]}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    <Mail className="h-2.5 w-2.5 mr-0.5" />
                    {c.email_count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Contact List + Profile */}
      <div className="flex gap-6">
        <div className="flex-1 space-y-1">
          {filtered === null ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-muted-foreground">No contacts found</p>
            </div>
          ) : (
            filtered.map((c) => {
              const initials = getInitials(c.name || c.email);
              const color = getAvatarColor(c.name || c.email);
              const isExpanded = expandedEmail === c.email;
              return (
                <div key={c.email}>
                  <button
                    onClick={() => handleExpand(c.email)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/30 ${
                      isExpanded ? "border-primary bg-muted/30" : "border-border bg-card"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white shrink-0 ${color}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.name || c.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {c.email_count} emails
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {c.last_email ? format(new Date(c.last_email), "MMM d, yyyy") : ""}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 ml-4 md:hidden">
                      <ContactProfilePanel
                        email={c.email}
                        name={c.name}
                        onClose={() => setExpandedEmail(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Profile Panel */}
        {expandedEmail && (
          <div className="hidden md:block w-80 shrink-0">
            <div className="sticky top-4">
              <ContactProfilePanel
                email={expandedEmail}
                name={filtered?.find((c) => c.email === expandedEmail)?.name}
                onClose={() => setExpandedEmail(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
