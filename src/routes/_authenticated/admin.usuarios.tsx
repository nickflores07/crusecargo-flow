import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { inviteMember, updateMemberName } from "@/lib/team.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, ShieldAlert, UserPlus, Pencil, Check, X, Mail } from "lucide-react";

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
  const [invite, setInvite] = useState({ email: "", nombre: "", rol: "ejecutivo" as AppRole });
  const [inviting, setInviting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const invokeInvite = useServerFn(inviteMember);
  const invokeUpdateName = useServerFn(updateMemberName);

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

  const handleInvite = async () => {
    if (!invite.email.trim() || !invite.nombre.trim()) {
      return toast.error("Completa nombre y correo del ejecutivo.");
    }
    setInviting(true);
    try {
      await invokeInvite({ data: invite });
      toast.success(`Invitación enviada a ${invite.email}`);
      setInvite({ email: "", nombre: "", rol: "ejecutivo" });
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo invitar";
      toast.error(msg);
    } finally {
      setInviting(false);
    }
  };

  const saveName = async (userId: string) => {
    if (!editValue.trim()) return toast.error("El nombre no puede estar vacío");
    try {
      await invokeUpdateName({ data: { userId, nombre: editValue.trim() } });
      toast.success("Nombre actualizado");
      setEditingId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  };

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
        <h1 className="text-2xl font-bold tracking-tight">Equipo comercial</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invita a tus ejecutivos con el mismo nombre que aparece en tu Excel para que la importación
          les asigne automáticamente sus clientes. Aquí también puedes cambiar roles y corregir nombres.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invitar miembro</CardTitle>
          <CardDescription>Recibirá un correo para crear su contraseña y acceder al CRM.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-[1.2fr_1.4fr_1fr_auto] gap-2 items-end">
            <div>
              <Label htmlFor="inv-nombre" className="text-xs">Nombre completo (como en Excel)</Label>
              <Input id="inv-nombre" placeholder="Apellidos, Nombres" value={invite.nombre}
                onChange={(e) => setInvite((s) => ({ ...s, nombre: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="inv-email" className="text-xs">Correo</Label>
              <Input id="inv-email" type="email" placeholder="ejecutivo@cruzdelsur.com.pe" value={invite.email}
                onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="inv-rol" className="text-xs">Rol</Label>
              <Select value={invite.rol} onValueChange={(v) => setInvite((s) => ({ ...s, rol: v as AppRole }))}>
                <SelectTrigger id="inv-rol"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Invitar
            </Button>
          </div>
        </CardContent>
      </Card>

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
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            className="h-8" onKeyDown={(e) => { if (e.key === "Enter") void saveName(r.id); if (e.key === "Escape") setEditingId(null); }} />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void saveName(r.id)}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <p className="font-medium truncate flex items-center gap-2">
                          {r.nombre || "(sin nombre)"}
                          {isMe && <Badge variant="outline" className="text-[10px]">Tú</Badge>}
                          <button type="button" onClick={() => { setEditingId(r.id); setEditValue(r.nombre || ""); }}
                            className="text-muted-foreground hover:text-foreground" title="Editar nombre">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </p>
                      )}
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