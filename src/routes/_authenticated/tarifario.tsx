import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Tags, Search, Building2, Globe2 } from "lucide-react";
import { ClienteComboboxLoader, useClientes, clienteLabel } from "@/components/clientes/cliente-combobox";

export const Route = createFileRoute("/_authenticated/tarifario")({
  component: TarifarioPage,
});

type Tarifa = {
  id: string;
  origen: string;
  destino: string;
  servicio: string;
  cliente_id: string | null;
  precio_por_kg: number;
  precio_minimo: number;
  peso_minimo_kg: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  notas: string | null;
  activo: boolean;
};

const SERVICIOS = ["encomienda", "carga", "paqueteria", "documentos", "otro"];

const emptyForm = () => ({
  origen: "",
  destino: "",
  servicio: "encomienda",
  cliente_id: "" as string,
  precio_por_kg: "0",
  precio_minimo: "0",
  peso_minimo_kg: "0",
  vigente_desde: new Date().toISOString().slice(0, 10),
  vigente_hasta: "",
  notas: "",
  activo: true,
});

function TarifarioPage() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const canManage = isAdmin || isSupervisor;
  const { clientes } = useClientes();
  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const [rows, setRows] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [servicioFilter, setServicioFilter] = useState("todos");
  const [alcance, setAlcance] = useState<"todos" | "cliente" | "general">("todos");
  const [showInactivas, setShowInactivas] = useState(false);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Tarifa | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tarifas")
      .select("id, origen, destino, servicio, cliente_id, precio_por_kg, precio_minimo, peso_minimo_kg, vigente_desde, vigente_hasta, notas, activo")
      .order("activo", { ascending: false })
      .order("vigente_desde", { ascending: false });
    if (error) toast.error("No pudimos cargar el tarifario");
    setRows((data ?? []) as Tarifa[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (!showInactivas && !t.activo) return false;
      if (servicioFilter !== "todos" && t.servicio !== servicioFilter) return false;
      if (alcance === "cliente" && !t.cliente_id) return false;
      if (alcance === "general" && t.cliente_id) return false;
      if (!term) return true;
      const cli = t.cliente_id ? clienteLabel(clientesMap.get(t.cliente_id)) : "";
      const hay = [t.origen, t.destino, t.servicio, cli, t.notas].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, servicioFilter, alcance, showInactivas, clientesMap]);

  const kpis = useMemo(() => {
    const activas = rows.filter((r) => r.activo);
    const rutas = new Set(activas.map((r) => `${r.origen.toLowerCase()}→${r.destino.toLowerCase()}`));
    const especificas = activas.filter((r) => r.cliente_id).length;
    return { total: activas.length, rutas: rutas.size, especificas };
  }, [rows]);

  const openNueva = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEditar = (t: Tarifa) => {
    setEditing(t);
    setForm({
      origen: t.origen,
      destino: t.destino,
      servicio: t.servicio,
      cliente_id: t.cliente_id ?? "",
      precio_por_kg: String(t.precio_por_kg),
      precio_minimo: String(t.precio_minimo),
      peso_minimo_kg: String(t.peso_minimo_kg),
      vigente_desde: t.vigente_desde,
      vigente_hasta: t.vigente_hasta ?? "",
      notas: t.notas ?? "",
      activo: t.activo,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.origen.trim() || !form.destino.trim()) return toast.error("Ingresa origen y destino");
    setSaving(true);
    const payload = {
      origen: form.origen.trim(),
      destino: form.destino.trim(),
      servicio: form.servicio,
      cliente_id: form.cliente_id || null,
      precio_por_kg: Number(form.precio_por_kg || 0),
      precio_minimo: Number(form.precio_minimo || 0),
      peso_minimo_kg: Number(form.peso_minimo_kg || 0),
      vigente_desde: form.vigente_desde,
      vigente_hasta: form.vigente_hasta || null,
      notas: form.notas || null,
      activo: form.activo,
    };
    const { error } = editing
      ? await supabase.from("tarifas").update(payload).eq("id", editing.id)
      : await supabase.from("tarifas").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Tarifa actualizada" : "Tarifa creada");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta tarifa?")) return;
    const { error } = await supabase.from("tarifas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const toggleActivo = async (t: Tarifa) => {
    const { error } = await supabase.from("tarifas").update({ activo: !t.activo }).eq("id", t.id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Tags className="h-6 w-6" /> Tarifario
          </h1>
          <p className="text-sm text-muted-foreground">
            Precios por ruta y cliente que se usan al cotizar. Alimenta el módulo de Cotizaciones.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNueva}><Plus className="h-4 w-4" /> Nueva tarifa</Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Tarifas activas" value={String(kpis.total)} />
        <Kpi label="Rutas cubiertas" value={String(kpis.rutas)} />
        <Kpi label="Específicas por cliente" value={String(kpis.especificas)} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ruta, cliente, notas…" className="pl-9" />
            </div>
            <Select value={servicioFilter} onValueChange={setServicioFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los servicios</SelectItem>
                {SERVICIOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={alcance} onValueChange={(v) => setAlcance(v as typeof alcance)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="cliente">Solo cliente específico</SelectItem>
                <SelectItem value="general">Solo generales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showInactivas} onChange={(e) => setShowInactivas(e.target.checked)} />
              Mostrar tarifas inactivas
            </label>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-lg">
              <Tags className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">{rows.length === 0 ? "Aún no hay tarifas cargadas" : "Sin resultados"}</p>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0
                  ? "Registra la primera tarifa para que las cotizaciones auto-sugieran precios."
                  : "Ajusta los filtros para encontrar tarifas."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Alcance</TableHead>
                    <TableHead className="text-right">S/ x kg</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead>Vigencia</TableHead>
                    <TableHead>Estado</TableHead>
                    {canManage && <TableHead />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const cli = t.cliente_id ? clientesMap.get(t.cliente_id) : null;
                    return (
                      <TableRow key={t.id} className={!t.activo ? "opacity-60" : ""}>
                        <TableCell className="font-medium whitespace-nowrap">{t.origen} → {t.destino}</TableCell>
                        <TableCell className="capitalize text-sm">{t.servicio}</TableCell>
                        <TableCell className="text-xs">
                          {cli ? (
                            <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {clienteLabel(cli)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground"><Globe2 className="h-3 w-3" /> General</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{Number(t.precio_por_kg).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{Number(t.precio_minimo).toFixed(2)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {t.vigente_desde}{t.vigente_hasta ? ` → ${t.vigente_hasta}` : " → sin fin"}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => canManage && void toggleActivo(t)}
                            className={`text-[10px] uppercase px-2 py-0.5 rounded ${t.activo ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-gray-500/10 text-gray-600"}`}
                            disabled={!canManage}
                          >
                            {t.activo ? "activa" : "inactiva"}
                          </button>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon" onClick={() => openEditar(t)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => void remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tarifa" : "Nueva tarifa"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Origen</Label><Input value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} placeholder="Lima" /></div>
            <div><Label>Destino</Label><Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} placeholder="Arequipa" /></div>
            <div>
              <Label>Servicio</Label>
              <Select value={form.servicio} onValueChange={(v) => setForm({ ...form, servicio: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICIOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente (opcional)</Label>
              <ClienteComboboxLoader
                value={form.cliente_id}
                onChange={(id) => setForm({ ...form, cliente_id: id })}
                placeholder="Tarifa general (sin cliente)"
              />
              {form.cliente_id && (
                <button type="button" onClick={() => setForm({ ...form, cliente_id: "" })} className="text-[11px] text-muted-foreground hover:text-foreground mt-1">
                  Quitar cliente (dejar general)
                </button>
              )}
            </div>
            <div><Label>Precio por kg (S/)</Label><Input type="number" step="0.01" value={form.precio_por_kg} onChange={(e) => setForm({ ...form, precio_por_kg: e.target.value })} /></div>
            <div><Label>Precio mínimo (S/)</Label><Input type="number" step="0.01" value={form.precio_minimo} onChange={(e) => setForm({ ...form, precio_minimo: e.target.value })} /></div>
            <div><Label>Peso mínimo (kg)</Label><Input type="number" step="0.01" value={form.peso_minimo_kg} onChange={(e) => setForm({ ...form, peso_minimo_kg: e.target.value })} /></div>
            <div />
            <div><Label>Vigente desde</Label><Input type="date" value={form.vigente_desde} onChange={(e) => setForm({ ...form, vigente_desde: e.target.value })} /></div>
            <div><Label>Vigente hasta</Label><Input type="date" value={form.vigente_hasta} onChange={(e) => setForm({ ...form, vigente_hasta: e.target.value })} /></div>
            <div className="col-span-2"><Label>Notas</Label><Textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Restricciones, tiempos de tránsito, condiciones…" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              Tarifa activa (disponible para cotizar)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}