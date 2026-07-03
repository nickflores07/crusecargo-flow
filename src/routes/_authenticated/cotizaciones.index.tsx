import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileText, Search, ArrowRight, Trash2 } from "lucide-react";
import { useClientes, clienteLabel } from "@/components/clientes/cliente-combobox";
import { NuevaCotizacionDialog } from "@/components/cotizaciones/nueva-cotizacion-dialog";

export const Route = createFileRoute("/_authenticated/cotizaciones/")({
  component: CotizacionesList,
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
};

const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador", enviada: "Enviada", pendiente: "Pendiente",
  aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};
const ESTADO_COLOR: Record<Estado, string> = {
  borrador: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  enviada: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  pendiente: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  aceptada: "bg-green-500/10 text-green-700 dark:text-green-300",
  rechazada: "bg-red-500/10 text-red-700 dark:text-red-300",
  vencida: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

function CotizacionesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const [rows, setRows] = useState<Cot[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("id, cliente_id, numero, fecha_emision, fecha_vencimiento, estado, subtotal, igv, total")
      .order("fecha_emision", { ascending: false });
    if (error) toast.error("No pudimos cargar las cotizaciones");
    setRows((data ?? []) as Cot[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hoy = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => {
      if (estado !== "todos" && r.estado !== estado) return false;
      if (clienteFilter !== "todos" && r.cliente_id !== clienteFilter) return false;
      if (desde && r.fecha_emision < desde) return false;
      if (hasta && r.fecha_emision > hasta) return false;
      if (!term) return true;
      const cli = clientesMap.get(r.cliente_id);
      const hay = [r.numero, clienteLabel(cli)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, estado, clienteFilter, desde, hasta, clientesMap]);

  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const aceptadas = filtered.filter((r) => r.estado === "aceptada");
    const enviadas = filtered.filter((r) => ["enviada", "pendiente"].includes(r.estado));
    const pct = filtered.length === 0 ? 0 : Math.round((aceptadas.length / filtered.length) * 100);
    return {
      count: filtered.length,
      total,
      montoAceptado: aceptadas.reduce((s, r) => s + Number(r.total ?? 0), 0),
      pipeline: enviadas.reduce((s, r) => s + Number(r.total ?? 0), 0),
      pct,
    };
  }, [filtered]);

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Propuestas comerciales. Los precios se sugieren desde el Tarifario.
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nueva cotización</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Cotizaciones" value={String(kpis.count)} />
        <Kpi label="Pipeline (S/)" value={kpis.pipeline.toFixed(2)} hint="Enviadas + pendientes" />
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
                const hoy = new Date().toISOString().slice(0, 10);
                const venc = c.fecha_vencimiento && c.fecha_vencimiento < hoy && !["aceptada", "rechazada"].includes(c.estado);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to="/cotizaciones/$id" params={{ id: c.id }} className="font-medium hover:underline">
                          {c.numero}
                        </Link>
                        {venc && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-300">vencida</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        <Link to="/clientes/$id" params={{ id: c.cliente_id }} className="hover:underline">
                          {clienteLabel(cli) || "—"}
                        </Link>
                        {" · "}Emitida {c.fecha_emision}
                        {c.fecha_vencimiento ? ` · vence ${c.fecha_vencimiento}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">S/ {Number(c.total).toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">IGV incl.</p>
                    </div>
                    <span className={`h-7 px-2 grid place-items-center rounded text-xs ${ESTADO_COLOR[c.estado]}`}>
                      {ESTADO_LABEL[c.estado]}
                    </span>
                    <Link to="/cotizaciones/$id" params={{ id: c.id }}>
                      <Button variant="ghost" size="icon" title="Ver detalle"><ArrowRight className="h-4 w-4" /></Button>
                    </Link>
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

      <NuevaCotizacionDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={(id) => {
          setOpenNew(false);
          navigate({ to: "/cotizaciones/$id", params: { id } });
        }}
      />
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}