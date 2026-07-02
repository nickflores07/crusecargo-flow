import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Target, Truck, FileText, Calendar,
  Sparkles, Settings, Truck as TruckIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

const nav = [
  { title: "Inicio", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Seguimiento", url: "/seguimiento", icon: ClipboardList, soon: true },
  { title: "Oportunidades", url: "/oportunidades", icon: Target, soon: true },
  { title: "Envíos", url: "/envios", icon: Truck, soon: true },
  { title: "Cotizaciones", url: "/cotizaciones", icon: FileText, soon: true },
  { title: "Agenda", url: "/agenda", icon: Calendar, soon: true },
  { title: "Asistente IA", url: "/asistente", icon: Sparkles, soon: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin } = useAuth();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shrink-0">
            <TruckIcon className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Cruz del Sur</p>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight">CRM Comercial</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    {item.soon ? (
                      <button type="button" className="opacity-60 cursor-not-allowed w-full" title="Muy pronto">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <span className="flex items-center justify-between w-full">
                            <span>{item.title}</span>
                            <span className="text-[9px] uppercase tracking-wide text-sidebar-foreground/50">pronto</span>
                          </span>
                        )}
                      </button>
                    ) : (
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin/usuarios")} tooltip="Usuarios y roles">
                    <Link to="/admin/usuarios">
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Usuarios y roles</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
