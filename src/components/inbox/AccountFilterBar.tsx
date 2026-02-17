import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Account {
  id: string;
  email: string;
  provider: string;
  sync_status: string;
}

interface AccountFilterBarProps {
  selectedAccountIds: string[];
  onSelectionChange: (ids: string[]) => void;
  accounts: Account[];
}

const PROVIDER_COLORS: Record<string, string> = {
  google: "bg-red-500",
  microsoft: "bg-blue-500",
};

export function AccountIndicator({ provider, email }: { provider?: string; email?: string }) {
  if (!provider) return null;
  const dotColor = PROVIDER_COLORS[provider] ?? "bg-muted-foreground";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          via {email || provider}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AccountFilterBar({ selectedAccountIds, onSelectionChange, accounts }: AccountFilterBarProps) {
  if (accounts.length < 2) return null;

  const allSelected = selectedAccountIds.length === 0;

  const toggleAccount = (accountId: string) => {
    if (allSelected) {
      // Switch from "all" to just this one
      onSelectionChange([accountId]);
    } else if (selectedAccountIds.includes(accountId)) {
      const next = selectedAccountIds.filter((id) => id !== accountId);
      onSelectionChange(next); // empty = all
    } else {
      onSelectionChange([...selectedAccountIds, accountId]);
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 overflow-x-auto">
      <button
        onClick={() => onSelectionChange([])}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
          allSelected
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/50"
        }`}
      >
        All Accounts
      </button>
      {accounts.map((acc) => {
        const isSelected = selectedAccountIds.includes(acc.id);
        const dotColor = PROVIDER_COLORS[acc.provider] ?? "bg-muted-foreground";
        return (
          <button
            key={acc.id}
            onClick={() => toggleAccount(acc.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            {acc.email}
          </button>
        );
      })}
    </div>
  );
}
