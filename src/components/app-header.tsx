import { Bell, Moon, Search, Sun, LogOut, User as UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

      <div className="relative flex-1 max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nombre, RUC/DNI, teléfono…"
          className="pl-9 h-9"
          disabled
          title="Disponible cuando agreguemos clientes"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} title="Cambiar tema" aria-label="Cambiar tema">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" title="Notificaciones" aria-label="Notificaciones" className="relative" disabled>
          <Bell className="h-4 w-4" />
        </Button>

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
            <DropdownMenuItem disabled>
              <UserIcon className="h-4 w-4 mr-2" /> Mi perfil (pronto)
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
