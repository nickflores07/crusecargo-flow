import { Bell, Moon, Search, Sun, LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlobalSearch } from "@/components/global-search";
import { Link } from "@tanstack/react-router";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [alerts, setAlerts] = useState<{ label: string; link: string }[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const hoy = new Date();
      const en7 = new Date(hoy); en7.setDate(hoy.getDate() + 7);
      const hISO = hoy.toISOString().slice(0, 10);
      const en7ISO = en7.toISOString().slice(0, 10);
      const [op, cot, seg] = await Promise.all([
        supabase.from("oportunidades")
          .select("id, titulo, fecha_cierre_estimada, estado")
          .not("fecha_cierre_estimada", "is", null)
          .gte("fecha_cierre_estimada", hISO).lte("fecha_cierre_estimada", en7ISO),
        supabase.from("cotizaciones")
          .select("id, numero, fecha_vencimiento, estado")
          .not("fecha_vencimiento", "is", null)
          .lt("fecha_vencimiento", hISO),
        supabase.from("seguimientos")
          .select("id, tipo, fecha")
          .lt("fecha", hISO),
      ]);
      if (cancel) return;
      const a: { label: string; link: string }[] = [];
      const opAbiertas = ((op.data as any[]) ?? []).filter((r) => !["ganada", "perdida"].includes(r.estado));
      opAbiertas.forEach((r) => a.push({ label: `Cierre próximo: ${r.titulo}`, link: "/oportunidades" }));
      const cotVenc = ((cot.data as any[]) ?? []).filter((r) => !["aceptada", "rechazada"].includes(r.estado));
      cotVenc.forEach((r) => a.push({ label: `Cotización vencida: ${r.numero}`, link: "/cotizaciones" }));
      const segVenc = ((seg.data as any[]) ?? []).slice(0, 5);
      segVenc.forEach((r) => a.push({ label: `Seguimiento vencido: ${r.tipo || "actividad"}`, link: "/mi-dia" }));
      setAlerts(a);
      setAlertCount(a.length);
    })();
    return () => { cancel = true; };
  }, [user]);

  const nombreCompleto = (user?.user_metadata?.nombre as string) || user?.email || "?";
  const initials = nombreCompleto
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="h-14 border-b bg-background flex items-center gap-2 px-2 md:px-4 sticky top-0 z-30">
      <SidebarTrigger />

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="relative flex-1 max-w-md h-9 rounded-md border bg-background text-left px-3 flex items-center gap-2 text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="truncate">Buscar cliente, contacto u oportunidad…</span>
        <kbd className="ml-auto hidden md:inline text-[10px] px-1.5 py-0.5 rounded border bg-muted">Ctrl K</kbd>
      </button>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} title="Cambiar tema" aria-label="Cambiar tema">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="Notificaciones" aria-label="Notificaciones" className="relative">
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold grid place-items-center">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="p-3 border-b">
              <p className="text-sm font-semibold">Alertas</p>
              <p className="text-xs text-muted-foreground">Actividades vencidas y próximas.</p>
            </div>
            <div className="max-h-80 overflow-auto">
              {alerts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Sin alertas por ahora 🎉</p>
              ) : (
                <ul className="divide-y">
                  {alerts.slice(0, 12).map((a, i) => (
                    <li key={i}>
                      <Link to={a.link} className="block px-3 py-2 text-sm hover:bg-muted/60 truncate">{a.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t p-2">
              <Link to="/mi-dia" className="block text-center text-xs text-primary hover:underline py-1">
                Ir a Mi día
              </Link>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menú de usuario">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="font-medium truncate">{nombreCompleto}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {roles.length === 0 && <Badge variant="outline" className="text-[10px]">Sin rol</Badge>}
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px] capitalize">{r}</Badge>
                  ))}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/configuracion" })}>
              <UserIcon className="h-4 w-4 mr-2" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth" });
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
