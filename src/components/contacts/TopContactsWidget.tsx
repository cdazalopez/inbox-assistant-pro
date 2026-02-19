import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ContactListItem, contactDisplayName, contactEmail, getInitials, getAvatarColor } from "./types";
import { Users } from "lucide-react";
import { format } from "date-fns";

export default function TopContactsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ContactListItem[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    awsApi.getContactsList(user.id, 5).then(setContacts).catch(() => setContacts([]));
  }, [user?.id]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Top Contacts</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate("/contacts")}>
          View all
        </Button>
      </div>
      <div className="divide-y divide-border">
        {contacts === null ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))
        ) : contacts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground">No contacts yet</p>
          </div>
        ) : (
          contacts.map((c) => {
            const dn = contactDisplayName(c);
            const em = contactEmail(c);
            if (!em) return null;
            const initials = getInitials(dn);
            const color = getAvatarColor(dn);
            return (
              <button
                key={em}
                onClick={() => navigate(`/contacts?email=${encodeURIComponent(em)}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${color}`}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{dn}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{em}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-foreground">{c.email_count}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.last_email ? format(new Date(c.last_email), "MMM d") : ""}
                  </p>
                </div>
                <span className="text-muted-foreground text-[10px]">→</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
