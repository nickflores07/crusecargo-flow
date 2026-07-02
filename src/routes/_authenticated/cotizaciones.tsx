import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, FileText, Trash2, Search, ChevronsUpDown, Check, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cotizaciones")({
  component: CotizacionesPage,
});

type Estado = "borrador" | "enviada" | "pendiente" | "aceptada" | "rechazada" | "vencida";
type Cot = {
  id: string;
  cliente_id: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: Estado;
  subtotal: number;
  igv: number;
  total: number;
  notas: string | null;
};
type Item = { descripcion: string; cantidad: string; precio_unit: string };
type CotItemRow = { id: string; descripcion: string; cantidad: number; precio_unit: number; importe: number; orden: number };
type ClienteMini = { id: string; tipo: "empresa" | "persona"; razon_social: string | null; nombre_completo: string | null };

const IGV_RATE = 0.18;

const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};
const ESTADO_COLOR: Record<Estado, string> = {
  borrador: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  enviada: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  pendiente: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  aceptada: "bg-green-500/10 text-green-700 dark:text-green-300",
  rechazada: "bg-red-500/10 text-red-700 dark:text-red-300",
  vencida: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

function generarNumero() {
  const d = new Date();
  const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `COT-${yyyymm}-${rand}`;
}

const clienteLabel = (c?: ClienteMini) =>
  !c ? "" : (c.tipo === "empresa" ? c.razon_social : c.nombre_completo) || "(sin nombre)";

function CotizacionesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Cot[]>([]);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVenc, setFechaVenc] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<Item[]>([{ descripcion: "", cantidad: "1", precio_unit: "0" }]);

  const [viewing, setViewing] = useState<Cot | null>(null);
  const [viewItems, setViewItems] = useState<CotItemRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: cs }] = await Promise.all([
      supabase.from("cotizaciones")
        .select("id, cliente_id, numero, fecha_emision, fecha_vencimiento, estado, subtotal, igv, total, notas")
        .order("fecha_emision", { ascending: false }),
      supabase.from("clientes").select("id, tipo, razon_social, nombre_completo").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error("No pudimos cargar las cotizaciones");
    setRows((data ?? []) as Cot[]);
    setClientes((cs ?? []) as ClienteMini[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (estado !== "todos" && r.estado !== estado) return false;
      if (clienteFilter !== "todos" && r.cliente_id !== clienteFilter) return false;
      if (desde && r.fecha_emision < desde) return false;
      if (hasta && r.fecha_emision > hasta) return false;
      if (!term) return true;
      const cli = clientesMap.get(r.cliente_id);
      const hay = [r.numero, r.notas, clienteLabel(cli)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, estado, clienteFilter, desde, hasta, clientesMap]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const total = filtered.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const aceptadas = filtered.filter((r) => r.estado === "aceptada").length;
    const montoAceptado = filtered.filter((r) => r.estado === "aceptada").reduce((s, r) => s + Number(r.total ?? 0), 0);
    const pct = count === 0 ? 0 : Math.round((aceptadas / count) * 100);
    return { count, total, montoAceptado, pct };
  }, [filtered]);

  const resetForm = () => {
    setClienteId("");
    setNumero(generarNumero());
    setFechaEmision(new Date().toISOString().slice(0, 10));
    setFechaVenc("");
    setNotas("");
    setItems([{ descripcion: "", cantidad: "1", precio_unit: "0" }]);
  };
  const openNueva = () => { resetForm(); setOpen(true); };

  const totales = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + Number(it.cantidad || 0) * Number(it.precio_unit || 0), 0);
    const igv = subtotal * IGV_RATE;
    return { subtotal, igv, total: subtotal + igv };
  }, [items]);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { descripcion: "", cantidad: "1", precio_unit: "0" }]);
  const removeItem = (i: number) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const save = async () => {
    if (!clienteId) return toast.error("Selecciona el cliente");
    if (!numero.trim()) return toast.error("Ingresa el número de cotización");
    if (items.every((it) => !it.descripcion.trim())) return toast.error("Agrega al menos un ítem");
    setSaving(true);
    const { data: cot, error } = await supabase.from("cotizaciones").insert({
      cliente_id: clienteId,
      ejecutivo_id: user?.id ?? null,
      created_by: user?.id ?? null,
      numero,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVenc || null,
      estado: "borrador",
      moneda: "PEN",
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
      notas: notas || null,
    }).select("id").single();
    if (error || !cot) { setSaving(false); return toast.error("No se pudo crear: " + (error?.message ?? "")); }
    const payload = items.filter((it) => it.descripcion.trim()).map((it, idx) => {
      const c = Number(it.cantidad || 0);
      const p = Number(it.precio_unit || 0);
      return { cotizacion_id: cot.id, descripcion: it.descripcion, cantidad: c, precio_unit: p, importe: c * p, orden: idx };
    });
    const { error: e2 } = await supabase.from("cotizacion_items").insert(payload);
    setSaving(false);
    if (e2) return toast.error("Cotización creada pero fallaron los ítems: " + e2.message);
    toast.success("Cotización creada");
    setOpen(false);
    void load();
  };

  const updateEstado = async (id: string, e: Estado) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado: e } : x)));
    const { error } = await supabase.from("cotizaciones").update({ estado: e }).eq("id", id);
    if (error) { setRows(prev); toast.error(error.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const openView = async (c: Cot) => {
    setViewing(c);
    setViewLoading(true);
    setViewItems([]);
    const { data } = await supabase.from("cotizacion_items")
      .select("id, descripcion, cantidad, precio_unit, importe, orden")
      .eq("cotizacion_id", c.id).order("orden");
    setViewItems((data ?? []) as CotItemRow[]);
    setViewLoading(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">Todas las propuestas comerciales emitidas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNueva}><Plus className="h-4 w-4" /> Nueva cotización</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nueva cotización</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label>Cliente</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {clienteId ? clienteLabel(clientesMap.get(clienteId)) : <span className="text-muted-foreground">Selecciona…</span>}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Sin resultados.</CommandEmpty>
                          <CommandGroup>
                            {clientes.map((c) => (
                              <CommandItem key={c.id} value={clienteLabel(c)} onSelect={() => { setClienteId(c.id); setPickerOpen(false); }}>
                                <Check className={`h-4 w-4 mr-2 ${clienteId === c.id ? "opacity-100" : "opacity-0"}`} />
                                {clienteLabel(c)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div><Label>Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2 col-span-2 md:col-span-1 md:col-start-4">
                </div>
                <div><Label>Emisión</Label><Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} /></div>
                <div><Label>Vencimiento</Label><Input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} /></div>
              </div>
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_80px_110px_110px_40px] gap-2 p-2 text-[11px] uppercase text-muted-foreground bg-muted/30">
                  <div>Descripción</div><div className="text-right">Cant.</div>
                  <div className="text-right">P. Unit</div><div className="text-right">Importe</div><div />
                </div>
                {items.map((it, i) => {
                  const importe = Number(it.cantidad || 0) * Number(it.precio_unit || 0);
                  return (
                    <div key={i} className="grid grid-cols-[1fr_80px_110px_110px_40px] gap-2 p-2 border-t items-center">
                      <Input value={it.descripcion} onChange={(e) => setItem(i, { descripcion: e.target.value })} placeholder="Servicio, ruta, tipo..." className="h-8" />
                      <Input type="number" step="0.01" value={it.cantidad} onChange={(e) => setItem(i, { cantidad: e.target.value })} className="h-8 text-right" />
                      <Input type="number" step="0.01" value={it.precio_unit} onChange={(e) => setItem(i, { precio_unit: e.target.value })} className="h-8 text-right" />
                      <div className="text-right text-sm px-2">{importe.toFixed(2)}</div>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Agregar ítem</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <Label>Notas</Label>
                  <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Condiciones, validez..." />
                </div>
                <div className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>S/ {totales.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>IGV (18%)</span><span>S/ {totales.igv.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>S/ {totales.total.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cotización
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Cotizaciones" value={String(kpis.count)} />
        <Kpi label="Total emitido (S/)" value={kpis.total.toFixed(2)} />
        <Kpi label="Aceptado (S/)" value={kpis.montoAceptado.toFixed(2)} />
        <Kpi label="% Aceptación" value={`${kpis.pct}%`} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número o cliente..." className="pl-9" />
            </div>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{clienteLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {Object.entries(ESTADO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
            </div>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-lg">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">{rows.length === 0 ? "Aún no hay cotizaciones" : "Sin resultados"}</p>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0 ? "Crea la primera para empezar." : "Ajusta los filtros o la búsqueda."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => {
                const cli = clientesMap.get(c.cliente_id);
                const venc = c.fecha_vencimiento && c.fecha_vencimiento < new Date().toISOString().slice(0,10) && !["aceptada","rechazada"].includes(c.estado);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{c.numero}</p>
                        {venc && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-300">vencida</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        <Link to="/clientes/$id" params={{ id: c.cliente_id }} className="hover:underline">{clienteLabel(cli) || "—"}</Link>
                        {" · "}Emitida {c.fecha_emision}
                        {c.fecha_vencimiento ? ` · vence ${c.fecha_vencimiento}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">S/ {Number(c.total).toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">IGV incl.</p>
                    </div>
                    <Select value={c.estado} onValueChange={(v) => void updateEstado(c.id, v as Estado)}>
                      <SelectTrigger className={`h-8 w-[130px] text-xs ${ESTADO_COLOR[c.estado]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ESTADO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => void openView(c)} title="Ver detalle">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void remove(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Mostrando {filtered.length} de {rows.length}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cotización {viewing?.numero}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente: </span>{clienteLabel(clientesMap.get(viewing.cliente_id)) || "—"}</div>
                <div><span className="text-muted-foreground">Estado: </span><span className="capitalize">{ESTADO_LABEL[viewing.estado]}</span></div>
                <div><span className="text-muted-foreground">Emisión: </span>{viewing.fecha_emision}</div>
                <div><span className="text-muted-foreground">Vencimiento: </span>{viewing.fecha_vencimiento ?? "—"}</div>
              </div>
              <div className="rounded-lg border">
                <div className="grid grid-cols-[1fr_80px_110px_110px] gap-2 p-2 text-[11px] uppercase text-muted-foreground bg-muted/30">
                  <div>Descripción</div><div className="text-right">Cant.</div>
                  <div className="text-right">P. Unit</div><div className="text-right">Importe</div>
                </div>
                {viewLoading ? (
                  <div className="grid place-items-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : viewItems.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Sin ítems</p>
                ) : viewItems.map((it) => (
                  <div key={it.id} className="grid grid-cols-[1fr_80px_110px_110px] gap-2 p-2 border-t text-sm">
                    <div>{it.descripcion}</div>
                    <div className="text-right">{Number(it.cantidad)}</div>
                    <div className="text-right">{Number(it.precio_unit).toFixed(2)}</div>
                    <div className="text-right">{Number(it.importe).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <div className="rounded-lg border p-3 space-y-1 text-sm min-w-[220px]">
                  <div className="flex justify-between"><span>Subtotal</span><span>S/ {Number(viewing.subtotal).toFixed(2)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>IGV</span><span>S/ {Number(viewing.igv).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>S/ {Number(viewing.total).toFixed(2)}</span></div>
                </div>
              </div>
              {viewing.notas && (
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Notas</p>
                  <p className="whitespace-pre-wrap">{viewing.notas}</p>
                </div>
              )}
            </div>
          )}
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