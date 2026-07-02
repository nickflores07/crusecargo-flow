import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Plus, Pencil, Trash2, Check, X, Tags } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/sectores")({
  component: SectoresPage,
});

type SectorRow = { id: string; nombre: string; clientes: number };

function SectoresPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SectorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate({ to: "/", replace: true });
  }, [authLoading, isAdmin, navigate]);

  const load = async () => {
    setLoading(true);
    const [{ data: secs }, { data: cls }] = await Promise.all([
      supabase.from("sectores").select("id, nombre").order("nombre"),
      supabase.from("clientes").select("sector_id"),
    ]);
    const counts = new Map<string, number>();
    (cls ?? []).forEach((c) => {
      if (c.sector_id) counts.set(c.sector_id, (counts.get(c.sector_id) ?? 0) + 1);
    });
    setRows((secs ?? []).map((s) => ({ ...s, clientes: counts.get(s.id) ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const add = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return toast.error("Ingresa el nombre del sector");
    setSaving(true);
    const { error } = await supabase.from("sectores").insert({ nombre });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNuevo("");
    toast.success("Sector agregado");
    void load();
  };

  const saveEdit = async (id: string) => {
    const nombre = editValue.trim();
    if (!nombre) return toast.error("El nombre no puede estar vacío");
    const { error } = await supabase.from("sectores").update({ nombre }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sector actualizado");
    setEditingId(null);
    void load();
  };

  const remove = async (r: SectorRow) => {
    if (r.clientes > 0) {
      if (!confirm(`Este sector está asignado a ${r.clientes} cliente(s). Al eliminarlo se dejarán sin sector. ¿Continuar?`)) return;
    } else if (!confirm(`¿Eliminar el sector "${r.nombre}"?`)) return;
    const { error } = await supabase.from("sectores").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Sector eliminado");
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Tags className="h-6 w-6" /> Sectores
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Administra la lista maestra de sectores para clasificar a tus clientes. Los cambios se ven reflejados en toda la aplicación.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar nuevo sector</CardTitle>
          <CardDescription>Los ejecutivos podrán elegirlo al crear o editar clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Ej: Farmacéutica" value={nuevo} onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
            <Button onClick={add} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sectores registrados</CardTitle>
          <CardDescription>Total: {rows.length}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aún no hay sectores.</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <div className="flex-1 min-w-0">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1">
                        <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(r.id); if (e.key === "Escape") setEditingId(null); }} />
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void saveEdit(r.id)}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{r.nombre}</span>
                        <Badge variant="outline" className="text-[10px]">{r.clientes} cliente{r.clientes === 1 ? "" : "s"}</Badge>
                      </div>
                    )}
                  </div>
                  {editingId !== r.id && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => { setEditingId(r.id); setEditValue(r.nombre); }}
                        title="Editar nombre">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void remove(r)} title="Eliminar sector">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}