import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

type Row = {
  id: string;
  nombre: string;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  roles: AppRole[];
};

const ROLES: AppRole[] = ["administrador", "supervisor", "ejecutivo"];

function UsuariosPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles, error: e1 }, { data: userRoles, error: e2 }] = await Promise.all([
      supabase.from("profiles").select("id, nombre, telefono, activo, created_at").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (e1 || e2) {
      toast.error("No pudimos cargar los usuarios");
      setLoading(false);
      return;
    }
    const rolesByUser = new Map<string, AppRole[]>();
    (userRoles ?? []).forEach((r) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const setPrimaryRole = async (userId: string, newRole: AppRole, current: AppRole[]) => {
    if (userId === user?.id) return toast.error("No puedes cambiar tu propio rol.");
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error("No se pudo actualizar: " + delErr.message);
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) {
      toast.error("No se pudo asignar el rol: " + insErr.message);
      if (current[0]) await supabase.from("user_roles").insert({ user_id: userId, role: current[0] });
      return;
    }
    toast.success("Rol actualizado");
    void load();
  };

  if (authLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="mt-3 font-medium">Sin permisos</p>
        <p className="text-sm text-muted-foreground">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios y roles</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada persona que se registra entra como <b>ejecutivo</b>. Aquí puedes cambiarle el rol.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Miembros del equipo</CardTitle>
          <CardDescription>Total: {rows.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <Users className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">Todavía no hay más usuarios</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                Comparte el enlace de acceso con tu equipo. Cuando se registren aparecerán aquí para que les asignes su rol.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const currentRole = r.roles[0] ?? "ejecutivo";
                const isMe = r.id === user?.id;
                return (
                  <div key={r.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.nombre || "(sin nombre)"} {isMe && <Badge variant="outline" className="ml-2 text-[10px]">Tú</Badge>}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.telefono || "Sin teléfono"} · Se unió {new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.roles.map((role) => (
                        <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>
                      ))}
                      {r.roles.length === 0 && <Badge variant="outline">Sin rol</Badge>}
                    </div>
                    <Select
                      value={currentRole}
                      onValueChange={(v) => setPrimaryRole(r.id, v as AppRole, r.roles)}
                      disabled={isMe}
                    >
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Elegir rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}