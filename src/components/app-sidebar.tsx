import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Target, Truck, FileText, Calendar,
  Sparkles, Settings, Truck as TruckIcon, Tags, UserCog, ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useModulos, type ModuloVisible } from "@/hooks/use-modulos";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Users, Target, Truck, FileText, Calendar,
  Sparkles, Settings, Tags, UserCog, ShieldCheck,
};

function iconFor(name: string | null | undefined): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name];
  return LayoutDashboard;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { modulos } = useModulos();

  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  const menu = modulos.filter((m) => m.grupo === "menu");
  const admin = modulos.filter((m) => m.grupo === "admin");

  const renderItem = (m: ModuloVisible) => {
    const Icon = iconFor(m.icono);
    return (
      <SidebarMenuItem key={m.modulo_id}>
        <SidebarMenuButton asChild isActive={isActive(m.ruta)} tooltip={m.nombre}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Link to={m.ruta as any}>
            <Icon className="h-4 w-4" />
            {!collapsed && <span>{m.nombre}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shrink-0">
            <TruckIcon className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate font-display">Cruz del Sur</p>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight">CRM Comercial</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {menu.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Menú</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{menu.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{admin.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
