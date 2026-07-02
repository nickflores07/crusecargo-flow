import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Package, Search, Trash2, ChevronsUpDown, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/envios")({
  component: EnviosPage,
});

type Estado = "en_transito" | "entregado" | "devuelto" | "anulado";
type Envio = {
  id: string;
  cliente_id: string;
  fecha: string;
  guia: string | null;
  servicio: string | null;
  origen: string | null;
  destino: string | null;
  peso_kg: number | null;
  bultos: number | null;
  importe: number | null;
  estado: Estado;
  notas: string | null;
};
type ClienteMini = { id: string; tipo: "empresa" | "persona"; razon_social: string | null; nombre_completo: string | null };

const ESTADO_LABEL: Record<Estado, string> = {
  en_transito: "En tránsito",
  entregado: "Entregado",
  devuelto: "Devuelto",
  anulado: "Anulado",
};
const ESTADO_COLOR: Record<Estado, string> = {
  en_transito: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  entregado: "bg-green-500/10 text-green-700 dark:text-green-300",
  devuelto: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  anulado: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const emptyNew = {
  cliente_id: "",
  fecha: new Date().toISOString().slice(0, 10),
  guia: "",
  servicio: "",
  origen: "",
  destino: "",
  peso_kg: "",
  bultos: "",
  importe: "",
  estado: "en_transito" as Estado,
  notas: "",
};

const clienteLabel = (c?: ClienteMini) =>
  !c ? "" : (c.tipo === "empresa" ? c.razon_social : c.nombre_completo) || "(sin nombre)";

function EnviosPage() {
  const [rows, setRows] = useState<Envio[]>([]);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<string>("todos");
  const [clienteFilter, setClienteFilter] = useState<string>("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuevo, setNuevo] = useState({ ...emptyNew });
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: cs }] = await Promise.all([
      supabase.from("envios")
        .select("id, cliente_id, fecha, guia, servicio, origen, destino, peso_kg, bultos, importe, estado, notas")
        .order("fecha", { ascending: false }),
      supabase.from("clientes").select("id, tipo, razon_social, nombre_completo").order("created_at", { ascending: false }),
    ]);
    if (error) toast.error("No pudimos cargar los envíos");
    setRows((data ?? []) as Envio[]);
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
      if (desde && r.fecha < desde) return false;
      if (hasta && r.fecha > hasta) return false;
      if (!term) return true;
      const cli = clientesMap.get(r.cliente_id);
      const hay = [r.guia, r.servicio, r.origen, r.destino, r.notas, clienteLabel(cli)]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, estado, clienteFilter, desde, hasta, clientesMap]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const peso = filtered.reduce((s, r) => s + Number(r.peso_kg ?? 0), 0);
    const facturado = filtered.reduce((s, r) => s + Number(r.importe ?? 0), 0);
    const entregados = filtered.filter((r) => r.estado === "entregado").length;
    const pct = count === 0 ? 0 : Math.round((entregados / count) * 100);
    return { count, peso, facturado, pct };
  }, [filtered]);

  const num = (s: string) => (s === "" ? null : Number(s));

  const save = async () => {
    if (!nuevo.cliente_id) return toast.error("Selecciona el cliente");
    setSaving(true);
    const { error } = await supabase.from("envios").insert({
      cliente_id: nuevo.cliente_id,
      fecha: nuevo.fecha,
      guia: nuevo.guia || null,
      servicio: nuevo.servicio || null,
      origen: nuevo.origen || null,
      destino: nuevo.destino || null,
      peso_kg: num(nuevo.peso_kg),
      bultos: nuevo.bultos === "" ? null : Number(nuevo.bultos),
      importe: num(nuevo.importe),
      estado: nuevo.estado,
      notas: nuevo.notas || null,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo registrar: " + error.message);
    toast.success("Envío registrado");
    setOpen(false);
    setNuevo({ ...emptyNew });
    void load();
  };

  const updateEstado = async (id: string, e: Estado) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado: e } : x)));
    const { error } = await supabase.from("envios").update({ estado: e }).eq("id", id);
    if (error) { setRows(prev); toast.error(error.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este envío?")) return;
    const { error } = await supabase.from("envios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Envíos</h1>
          <p className="text-sm text-muted-foreground">Historial global de envíos de todos los clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /> Registrar envío</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nuevo envío</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Cliente</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {nuevo.cliente_id
                        ? clienteLabel(clientesMap.get(nuevo.cliente_id))
                        : <span className="text-muted-foreground">Selecciona un cliente…</span>}
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
                            <CommandItem
                              key={c.id}
                              value={clienteLabel(c)}
                              onSelect={() => { setNuevo((n) => ({ ...n, cliente_id: c.id })); setPickerOpen(false); }}
                            >
                              <Check className={`h-4 w-4 mr-2 ${nuevo.cliente_id === c.id ? "opacity-100" : "opacity-0"}`} />
                              {clienteLabel(c)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Fecha</Label><Input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></div>
              <div><Label>Guía</Label><Input value={nuevo.guia} onChange={(e) => setNuevo({ ...nuevo, guia: e.target.value })} placeholder="N° guía" /></div>
              <div className="col-span-2"><Label>Servicio</Label><Input value={nuevo.servicio} onChange={(e) => setNuevo({ ...nuevo, servicio: e.target.value })} placeholder="Encomienda, carga pesada..." /></div>
              <div><Label>Origen</Label><Input value={nuevo.origen} onChange={(e) => setNuevo({ ...nuevo, origen: e.target.value })} /></div>
              <div><Label>Destino</Label><Input value={nuevo.destino} onChange={(e) => setNuevo({ ...nuevo, destino: e.target.value })} /></div>
              <div><Label>Peso (kg)</Label><Input type="number" step="0.01" value={nuevo.peso_kg} onChange={(e) => setNuevo({ ...nuevo, peso_kg: e.target.value })} /></div>
              <div><Label>Bultos</Label><Input type="number" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} /></div>
              <div><Label>Importe (S/)</Label><Input type="number" step="0.01" value={nuevo.importe} onChange={(e) => setNuevo({ ...nuevo, importe: e.target.value })} /></div>
              <div>
                <Label>Estado</Label>
                <Select value={nuevo.estado} onValueChange={(v) => setNuevo({ ...nuevo, estado: v as Estado })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Notas</Label><Textarea rows={2} value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} /></div>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Envíos" value={String(kpis.count)} />
        <Kpi label="Peso (kg)" value={kpis.peso.toFixed(1)} />
        <Kpi label="Facturado (S/)" value={kpis.facturado.toFixed(2)} />
        <Kpi label="% Entregados" value={`${kpis.pct}%`} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar guía, ruta, cliente..." className="pl-9" />
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
              <Package className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">{rows.length === 0 ? "Aún no hay envíos registrados" : "Sin resultados"}</p>
              <p className="text-sm text-muted-foreground">
                {rows.length === 0 ? "Registra el primero para empezar." : "Ajusta los filtros o la búsqueda."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Guía</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const cli = clientesMap.get(r.cliente_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{r.fecha}</TableCell>
                        <TableCell className="max-w-[180px] truncate">
                          <Link to="/clientes/$id" params={{ id: r.cliente_id }} className="hover:underline">{clienteLabel(cli) || "—"}</Link>
                        </TableCell>
                        <TableCell className="text-xs">{r.guia ?? "—"}</TableCell>
                        <TableCell>{r.servicio ?? "—"}</TableCell>
                        <TableCell className="text-xs">{[r.origen, r.destino].filter(Boolean).join(" → ") || "—"}</TableCell>
                        <TableCell className="text-right">{r.peso_kg ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.importe != null ? Number(r.importe).toFixed(2) : "—"}</TableCell>
                        <TableCell>
                          <Select value={r.estado} onValueChange={(v) => void updateEstado(r.id, v as Estado)}>
                            <SelectTrigger className={`h-7 w-[130px] text-xs ${ESTADO_COLOR[r.estado]}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(ESTADO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Mostrando {filtered.length} de {rows.length}
            </p>
          )}
        </CardContent>
      </Card>
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