import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { Task, Followup, PRIORITY_COLORS, FOLLOWUP_TYPE_COLORS, FOLLOWUP_TYPE_LABELS } from "./types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { isAfter, isSameDay, parseISO, startOfDay } from "date-fns";

export default function TasksFollowupsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [followups, setFollowups] = useState<Followup[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    Promise.allSettled([
      awsApi.getTasks(user.id),
      awsApi.getFollowups(user.id),
    ]).then(([tasksRes, followupsRes]) => {
      if (tasksRes.status === "fulfilled") setTasks(tasksRes.value.tasks ?? []);
      if (followupsRes.status === "fulfilled") setFollowups(followupsRes.value.followups ?? []);
    });
  }, [user?.id]);

  const today = startOfDay(new Date());

  const overdueTasks = tasks?.filter(t => t.status !== "done" && t.due_date && isAfter(today, startOfDay(parseISO(t.due_date)))) ?? [];
  const dueTodayTasks = tasks?.filter(t => t.status !== "done" && t.due_date && isSameDay(parseISO(t.due_date), today)) ?? [];
  const pendingFollowups = followups?.filter(f => f.status === "pending") ?? [];

  // Combine upcoming items sorted by due date
  const upcomingItems: { type: "task" | "followup"; title: string; due: string; priority?: string; ftype?: string }[] = [];
  tasks?.filter(t => t.status !== "done" && t.due_date).forEach(t => {
    upcomingItems.push({ type: "task", title: t.title, due: t.due_date!, priority: t.priority });
  });
  followups?.filter(f => f.status === "pending").forEach(f => {
    upcomingItems.push({ type: "followup", title: f.email_subject ?? FOLLOWUP_TYPE_LABELS[f.type] ?? f.type, due: f.due_date, ftype: f.type });
  });
  upcomingItems.sort((a, b) => a.due.localeCompare(b.due));
  const top3 = upcomingItems.slice(0, 3);

  const loading = tasks === null || followups === null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <CheckSquare className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Tasks & Follow-ups</h2>
      </div>
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </>
        ) : (
          <>
            {/* Summary counts */}
            <div className="flex flex-wrap gap-2">
              {overdueTasks.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {overdueTasks.length} overdue
                </span>
              )}
              {dueTodayTasks.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
                  <Clock className="h-2.5 w-2.5" />
                  {dueTodayTasks.length} due today
                </span>
              )}
              {pendingFollowups.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                  <CheckSquare className="h-2.5 w-2.5" />
                  {pendingFollowups.length} pending follow-ups
                </span>
              )}
              {overdueTasks.length === 0 && dueTodayTasks.length === 0 && pendingFollowups.length === 0 && (
                <p className="text-xs text-muted-foreground">All caught up! ✨</p>
              )}
            </div>

            {/* Top upcoming items */}
            {top3.length > 0 && (
              <div className="space-y-2 mt-2">
                {top3.map((item, i) => {
                  const isOverdue = isAfter(today, startOfDay(parseISO(item.due)));
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${
                        item.type === "task" ? PRIORITY_COLORS[item.priority ?? "medium"] : FOLLOWUP_TYPE_COLORS[item.ftype ?? "reply_needed"]
                      }`}>
                        {item.type === "task" ? item.priority : FOLLOWUP_TYPE_LABELS[item.ftype ?? "reply_needed"]}
                      </span>
                      <span className="truncate text-foreground/80 flex-1">{item.title}</span>
                      <span className={`shrink-0 ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                        {item.due}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => navigate("/tasks")}>
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
