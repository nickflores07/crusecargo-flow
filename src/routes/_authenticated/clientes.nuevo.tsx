import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ClienteForm, type ClienteFormValues } from "@/components/clientes/cliente-form";

export const Route = createFileRoute("/_authenticated/clientes/nuevo")({
  component: NuevoCliente,
});

function NuevoCliente() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (v: ClienteFormValues) => {
    setSaving(true);
    const payload = {
      tipo: v.tipo,
      razon_social: v.tipo === "empresa" ? v.razon_social || null : null,
      ruc: v.tipo === "empresa" ? v.ruc || null : null,
      rubro: v.tipo === "empresa" ? v.rubro || null : null,
      nombre_completo: v.tipo === "persona" ? v.nombre_completo || null : null,
      dni: v.tipo === "persona" ? v.dni || null : null,
      direccion: v.direccion || null,
      ciudad: v.ciudad || null,
      telefono: v.telefono || null,
      correo: v.correo || null,
      estado: v.estado,
      notas: v.notas || null,
      ejecutivo_id: user?.id ?? null,
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from("clientes").insert(payload).select("id").single();
    setSaving(false);
    if (error) {
      toast.error("No se pudo crear: " + error.message);
      return;
    }
    toast.success("Cliente creado");
    void navigate({ to: "/clientes/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Volver a clientes</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Nuevo cliente</CardTitle>
          <CardDescription>Elige si es una empresa o persona. El formulario se adapta.</CardDescription>
        </CardHeader>
        <CardContent>
          <ClienteForm
            submitting={saving}
            onSubmit={handleSubmit}
            onCancel={() => navigate({ to: "/clientes" })}
          />
        </CardContent>
      </Card>
    </div>
  );
}