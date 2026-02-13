import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">Welcome to Inbox Agent</h1>
      <p className="mt-2 text-muted-foreground">
        Hello, {user?.user_metadata?.full_name || "there"}. Your intelligent inbox is ready.
      </p>
    </div>
  );
}
