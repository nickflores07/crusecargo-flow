import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, Save, User as UserIcon, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracion")({
  component: ConfiguracionPage,
});

function ConfiguracionPage() {
  const { user, roles, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nombre, telefono")
        .eq("id", user.id)
        .maybeSingle();
      if (cancel) return;
      setNombre(data?.nombre ?? "");
      setTelefono(data?.telefono ?? "");
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  const guardar = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nombre: nombre.trim() || user.email!, telefono: telefono.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("No se pudo guardar", { description: error.message });
    else toast.success("Perfil actualizado");
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">Preferencias personales y datos de tu cuenta.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Mi perfil</CardTitle>
          </div>
          <CardDescription>Cómo apareces dentro del CRM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Correo</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={loading} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={loading} placeholder="+51 ..." />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Roles asignados:</span>
            {roles.length === 0 && <Badge variant="outline">Sin rol</Badge>}
            {roles.map((r) => (
              <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={guardar} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-2" /> Guardar cambios
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apariencia</CardTitle>
          <CardDescription>Cambia entre modo claro y oscuro.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <div>
                <p className="text-sm font-medium">Tema {theme === "dark" ? "oscuro" : "claro"}</p>
                <p className="text-xs text-muted-foreground">Se guarda en este navegador.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggle}>
              Cambiar a {theme === "dark" ? "claro" : "oscuro"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Cruz del Sur Cargo</CardTitle>
          </div>
          <CardDescription>Información de la organización.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Producto</span><span>CRM Comercial</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Áreas comerciales</span><span>B2C · B2B</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Modelo de datos</span><span>Clientes · Contactos · Oportunidades · Cotizaciones · Envíos</span></div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Administración</CardTitle>
            </div>
            <CardDescription>Accesos rápidos a la gestión del sistema.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><a href="/admin/usuarios">Usuarios y roles</a></Button>
            <Button asChild variant="outline" size="sm"><a href="/admin/sectores">Sectores</a></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}