import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useModulos } from "@/hooks/use-modulos";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldAlert, Search, RotateCcw } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/permisos")({
  component: PermisosPage,
});

type Modulo = {
  id: string; nombre: string; icono: string | null;
  ruta: string; grupo: string; orden: number;
};
type PermisoRol = { rol: AppRole; modulo_id: string; visible: boolean };
type PermisoUser = { user_id: string; modulo_id: string; visible: boolean };
type Profile = { id: string; nombre: string };

const ROLES: AppRole[] = ["administrador", "supervisor", "ejecutivo"];
const ROL_LABEL: Record<AppRole, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  ejecutivo: "Ejecutivo",
};

function PermisosPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { refresh: refreshModulos } = useModulos();
  const navigate = useNavigate();
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [permisos, setPermisos] = useState<PermisoRol[]>([]);
  const [overrides, setOverrides] = useState<PermisoUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error("Solo administradores pueden ver esta pantalla.");
      navigate({ to: "/" });
    }
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: m }, { data: p }, { data: o }, { data: pr }] = await Promise.all([
      supabase.from("modulos_app").select("*").order("grupo").order("orden"),
      supabase.from("permisos_modulos_rol").select("*"),
      supabase.from("permisos_modulos_usuario").select("*"),
      supabase.from("profiles").select("id,nombre").order("nombre"),
    ]);
    setModulos((m ?? []) as Modulo[]);
    setPermisos((p ?? []) as PermisoRol[]);
    setOverrides((o ?? []) as PermisoUser[]);
    setProfiles((pr ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const rolMap = useMemo(() => {
    const m = new Map<string, boolean>();
    permisos.forEach((p) => m.set(`${p.rol}:${p.modulo_id}`, p.visible));
    return m;
  }, [permisos]);

  const overrideMap = useMemo(() => {
    const m = new Map<string, boolean>();
    overrides.forEach((p) => m.set(`${p.user_id}:${p.modulo_id}`, p.visible));
    return m;
  }, [overrides]);

  const toggleRol = async (rol: AppRole, modulo_id: string, current: boolean) => {
    setSaving(true);
    const nuevo = !current;
    const { error } = await supabase.from("permisos_modulos_rol")
      .upsert({ rol, modulo_id, visible: nuevo }, { onConflict: "rol,modulo_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPermisos((prev) => {
      const idx = prev.findIndex((p) => p.rol === rol && p.modulo_id === modulo_id);
      if (idx === -1) return [...prev, { rol, modulo_id, visible: nuevo }];
      const copy = [...prev]; copy[idx] = { ...copy[idx], visible: nuevo }; return copy;
    });
    void refreshModulos();
  };

  const setOverride = async (modulo_id: string, valor: boolean | null) => {
    if (!selectedUser) return;
    setSaving(true);
    if (valor === null) {
      const { error } = await supabase.from("permisos_modulos_usuario")
        .delete().eq("user_id", selectedUser).eq("modulo_id", modulo_id);
      setSaving(false);
      if (error) return toast.error(error.message);
      setOverrides((prev) => prev.filter((p) => !(p.user_id === selectedUser && p.modulo_id === modulo_id)));
    } else {
      const { error } = await supabase.from("permisos_modulos_usuario")
        .upsert({ user_id: selectedUser, modulo_id, visible: valor }, { onConflict: "user_id,modulo_id" });
      setSaving(false);
      if (error) return toast.error(error.message);
      setOverrides((prev) => {
        const idx = prev.findIndex((p) => p.user_id === selectedUser && p.modulo_id === modulo_id);
        if (idx === -1) return [...prev, { user_id: selectedUser, modulo_id, visible: valor }];
        const copy = [...prev]; copy[idx] = { ...copy[idx], visible: valor }; return copy;
      });
    }
    void refreshModulos();
  };

  const filteredProfiles = profiles.filter((p) =>
    p.nombre.toLowerCase().includes(userQuery.toLowerCase()),
  );

  if (authLoading || loading) {
    return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Módulos y permisos</h1>
          <p className="text-sm text-muted-foreground">
            Decide qué módulos ve cada rol y agrega excepciones puntuales por usuario.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Permisos por rol</CardTitle>
          <CardDescription>
            Marca qué módulos ve cada rol. Los cambios se reflejan inmediatamente en el menú lateral.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="text-left py-2 pr-3">Módulo</th>
                <th className="text-left py-2 pr-3">Grupo</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 px-3 text-center">{ROL_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modulos.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{m.nombre}</div>
                    <div className="text-xs text-muted-foreground">{m.ruta}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={m.grupo === "admin" ? "secondary" : "outline"} className="text-xs">
                      {m.grupo}
                    </Badge>
                  </td>
                  {ROLES.map((r) => {
                    const val = rolMap.get(`${r}:${m.id}`) ?? true;
                    return (
                      <td key={r} className="py-2 px-3 text-center">
                        <Switch
                          checked={val}
                          disabled={saving || r === "administrador"}
                          onCheckedChange={() => void toggleRol(r, m.id, val)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> El rol Administrador siempre conserva acceso total.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Excepciones por usuario</CardTitle>
          <CardDescription>
            Sobrescribe el permiso de rol para un usuario específico. Útil para dar acceso puntual sin cambiar todo el rol.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] items-end">
            <div>
              <Label className="text-xs">Buscar usuario</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Nombre del usuario…"
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full md:w-[280px]">
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {filteredProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
                {filteredProfiles.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin resultados</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="text-left py-2 pr-3">Módulo</th>
                    <th className="py-2 px-3 text-center">Override</th>
                    <th className="py-2 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {modulos.map((m) => {
                    const ov = overrideMap.get(`${selectedUser}:${m.id}`);
                    return (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{m.nombre}</div>
                          <div className="text-xs text-muted-foreground">{m.grupo} · {m.ruta}</div>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {ov === undefined ? (
                            <Badge variant="outline" className="text-xs">Usar permiso del rol</Badge>
                          ) : ov ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">Forzar visible</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Forzar oculto</Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" onClick={() => void setOverride(m.id, true)} disabled={saving}>
                              Visible
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void setOverride(m.id, false)} disabled={saving}>
                              Oculto
                            </Button>
                            {ov !== undefined && (
                              <Button size="sm" variant="ghost" onClick={() => void setOverride(m.id, null)} disabled={saving} title="Quitar override">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!selectedUser && (
            <p className="text-sm text-muted-foreground">
              Selecciona un usuario para gestionar sus excepciones.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}