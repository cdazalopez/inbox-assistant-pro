import { useState } from "react";
import { LayoutDashboard, Inbox, CheckSquare, FileText, Settings, LogOut, PenSquare, Calendar, Bot, FileType, Users, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import ComposeModal from "@/components/ComposeModal";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Inbox", url: "/inbox", icon: Inbox },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Autopilot", url: "/autopilot", icon: Bot },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Templates", url: "/templates", icon: FileType },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Briefings", url: "/briefings", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-4">
          <h1 className="text-lg font-bold text-foreground">Inbox Agent</h1>
        </SidebarHeader>
        <div className="px-3 pb-2">
          <Button className="w-full justify-start gap-2" onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4" />
            Compose
          </Button>
        </div>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end={item.url === "/dashboard"} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="p-4">
          <div className="mb-2">
            <p className="truncate text-sm font-medium text-foreground">{user?.user_metadata?.full_name || "User"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </SidebarFooter>
      </Sidebar>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </>
  );
}
