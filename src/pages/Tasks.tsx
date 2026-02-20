import { useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { awsApi } from "@/lib/awsApi";
import { useToast } from "@/hooks/use-toast";
import { Task, Followup, PRIORITY_COLORS, FOLLOWUP_TYPE_COLORS, FOLLOWUP_TYPE_LABELS } from "@/components/tasks/types";
import TaskModal from "@/components/tasks/TaskModal";
import FollowupModal from "@/components/tasks/FollowupModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Mail, Clock, CheckCircle2, Circle, PlayCircle, AlertTriangle } from "lucide-react";
import { isAfter, parseISO, startOfDay, format } from "date-fns";

const STATUS_ICONS: Record<string, React.ElementType> = {
  todo: Circle,
  in_progress: PlayCircle,
  done: CheckCircle2,
  overdue: AlertTriangle,
};

const NEXT_STATUS: Record<string, string> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

export default function Tasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTaskId = searchParams.get("taskId");
  const initialFollowupId = searchParams.get("followUpId");
  const highlightRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingFollowups, setLoadingFollowups] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"tasks" | "followups">("tasks");

  // Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoadingTasks(true);
    try {
      const data = await awsApi.getTasks(user.id, statusFilter === "all" ? undefined : statusFilter);
      setTasks(data.tasks ?? []);
    } catch {
      toast({ title: "Failed to load tasks", variant: "destructive" });
    } finally {
      setLoadingTasks(false);
    }
  }, [user?.id, statusFilter, toast]);

  const fetchFollowups = useCallback(async () => {
    if (!user?.id) return;
    setLoadingFollowups(true);
    try {
      const data = await awsApi.getFollowups(user.id);
      setFollowups(data.followups ?? []);
    } catch {
      toast({ title: "Failed to load follow-ups", variant: "destructive" });
    } finally {
      setLoadingFollowups(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchTasks();
    fetchFollowups();
  }, [fetchTasks, fetchFollowups]);

  // Auto-scroll to highlighted task/followup from URL param
  useEffect(() => {
    if (initialFollowupId && !initialTaskId) {
      setActiveTab("followups");
    }
  }, [initialFollowupId, initialTaskId]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  const handleSaveTask = async (data: {
    title: string;
    description?: string;
    priority: string;
    due_date?: string;
    email_id?: string;
  }) => {
    if (!user?.id) return;
    if (editingTask) {
      await awsApi.updateTask({ task_id: editingTask.id, user_id: user.id, ...data });
      toast({ title: "Task updated" });
    } else {
      await awsApi.createTask({ user_id: user.id, ...data });
      toast({ title: "Task created" });
    }
    setEditingTask(null);
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user?.id) return;
    try {
      await awsApi.deleteTask(taskId, user.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: "Task deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleCycleStatus = async (task: Task) => {
    if (!user?.id) return;
    const newStatus = NEXT_STATUS[task.status];
    try {
      await awsApi.updateTask({ task_id: task.id, user_id: user.id, status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as Task["status"] } : t)));
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleSaveFollowup = async (data: { type: string; due_date: string; notes?: string; email_id?: string }) => {
    if (!user?.id) return;
    if (editingFollowup) {
      await awsApi.updateFollowup({ followup_id: editingFollowup.id, user_id: user.id, ...data });
      toast({ title: "Follow-up updated" });
    } else {
      await awsApi.createFollowup({ user_id: user.id, ...data });
      toast({ title: "Follow-up created" });
    }
    setEditingFollowup(null);
    fetchFollowups();
  };

  const handleToggleFollowupStatus = async (followup: Followup) => {
    if (!user?.id) return;
    const newStatus = followup.status === "pending" ? "completed" : "pending";
    try {
      await awsApi.updateFollowup({ followup_id: followup.id, user_id: user.id, status: newStatus });
      setFollowups((prev) =>
        prev.map((f) => (f.id === followup.id ? { ...f, status: newStatus as Followup["status"] } : f)),
      );
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const handleDeleteFollowup = async (followupId: string) => {
    if (!user?.id) return;
    try {
      await awsApi.deleteFollowup(followupId, user.id);
      setFollowups((prev) => prev.filter((f) => f.id !== followupId));
      toast({ title: "Follow-up deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const today = startOfDay(new Date());

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <div className="flex gap-2">
          {activeTab === "tasks" ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Task
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setEditingFollowup(null);
                setFollowupModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> New Follow-up
            </Button>
          )}
        </div>
      </div>

      {/* Main tabs: Tasks vs Follow-ups */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tasks" | "followups")}>
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "tasks" && (
        <>
          {/* Status filter */}
          <Tabs
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
            }}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="todo">To Do</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Task list */}
          {loadingTasks ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No tasks yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Create your first task
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const StatusIcon = STATUS_ICONS[task.status] ?? Circle;
                const isOverdue =
                  task.due_date && task.status !== "done" && isAfter(today, startOfDay(parseISO(task.due_date)));
                const isOverdueStatus = (task.status as string) === "overdue";
                return (
                  <div
                    key={task.id}
                    ref={initialTaskId === task.id ? highlightRef : undefined}
                    className={`rounded-lg border bg-card p-4 transition-colors ${task.status === "done" ? "opacity-60" : ""} ${isOverdueStatus ? "border-destructive/50 bg-destructive/5" : ""} ${initialTaskId === task.id ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleCycleStatus(task)}
                        className="mt-0.5 shrink-0"
                        title={`Status: ${task.status}. Click to cycle.`}
                      >
                        <StatusIcon
                          className={`h-5 w-5 ${task.status === "done" ? "text-emerald-400" : task.status === "in_progress" ? "text-blue-400" : "text-muted-foreground"}`}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-medium text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${PRIORITY_COLORS[task.priority]}`}
                          >
                            {task.priority}
                          </span>
                          {(task.description?.toLowerCase().includes("briefing") ||
                            task.description?.startsWith("From:")) && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 px-1.5 py-0 text-[10px] font-medium leading-4">
                              📋 From Briefing
                            </span>
                          )}
                          {isOverdueStatus && (
                            <span className="inline-flex items-center rounded-full bg-destructive/20 text-destructive border border-destructive/30 px-1.5 py-0 text-[10px] font-medium leading-4">
                              Overdue — moved to Follow-ups
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {task.due_date && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}
                            >
                              <Clock className="h-3 w-3" />
                              {isOverdue ? "Overdue: " : ""}
                              {format(parseISO(task.due_date), "MMM d, yyyy")}
                            </span>
                          )}
                          {task.email_subject && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/inbox?emailId=${task.email_id}`);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-primary/80 truncate max-w-[200px] hover:text-primary cursor-pointer transition-colors"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              {task.email_subject}
                              <span className="text-[10px]">→</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingTask(task);
                            setTaskModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "followups" && (
        <>
          {loadingFollowups ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : followups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No follow-ups yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setEditingFollowup(null);
                  setFollowupModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Create your first follow-up
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {followups.map((followup) => {
                const isOverdue =
                  followup.status === "pending" && isAfter(today, startOfDay(parseISO(followup.due_date)));
                return (
                  <div
                    key={followup.id}
                    ref={initialFollowupId === followup.id ? highlightRef : undefined}
                    className={`rounded-lg border bg-card p-4 transition-colors ${followup.status === "completed" ? "opacity-60" : ""} ${initialFollowupId === followup.id ? "border-primary ring-1 ring-primary/30" : "border-border"}`}
                  >
                    <div className="flex items-start gap-3">
                      <button onClick={() => handleToggleFollowupStatus(followup)} className="mt-0.5 shrink-0">
                        {followup.status === "completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4 ${FOLLOWUP_TYPE_COLORS[followup.type]}`}
                          >
                            {FOLLOWUP_TYPE_LABELS[followup.type] ?? followup.type}
                          </span>
                          <span
                            className={`text-xs ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}
                          >
                            <Clock className="inline h-3 w-3 mr-0.5" />
                            {isOverdue ? "Overdue: " : ""}
                            {format(parseISO(followup.due_date), "MMM d, yyyy")}
                          </span>
                        </div>
                        {followup.notes && <p className="text-xs text-muted-foreground mt-1">{followup.notes}</p>}
                        {followup.email_subject && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inbox?emailId=${followup.email_id}`);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-primary/80 mt-1 truncate max-w-[250px] hover:text-primary cursor-pointer transition-colors"
                          >
                            <Mail className="h-3 w-3 shrink-0" />
                            {followup.email_subject}
                            <span className="text-[10px]">→</span>
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingFollowup(followup);
                            setFollowupModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteFollowup(followup.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <TaskModal
        open={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
        task={editingTask}
      />
      <FollowupModal
        open={followupModalOpen}
        onClose={() => {
          setFollowupModalOpen(false);
          setEditingFollowup(null);
        }}
        onSave={handleSaveFollowup}
        followup={editingFollowup}
      />
    </div>
  );
}
