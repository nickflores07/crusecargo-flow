import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Calendar as CalendarIcon, Plus, CheckCircle2, X, ChevronLeft, ChevronRight,
  RotateCcw, Check as CheckIcon, Building2, Phone, Handshake, MoreHorizontal,
  LayoutGrid, List, Clock, Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/rutas")({
  component: PlanSemanalPage,
});

type Visita = {
  id: string;
  ejecutivo_id: string;
  cliente_id: string;
  fecha_planificada: string;
  hora: string | null;
  tipo: string;
  motivo: string | null;
  detalles: string | null;
  logro: string | null;
  proxima_accion: string | null;
  proxima_accion_fecha: string | null;
  estado: "planificada" | "realizada" | "reprogramada" | "cancelada";
  resultado: string | null;
  notas: string | null;
  cliente?: { razon_social: string | null; nombre_completo: string | null; ciudad: string | null } | null;
};

type ClienteLite = { id: string; label: string };
type Profile = { id: string; nombre: string };

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const TIPOS: Array<{ value: string; label: string; icon: typeof Building2; color: string }> = [
  { value: "visita", label: "Visita", icon: Building2, color: "text-blue-600 bg-blue-500/10" },
  { value: "llamada", label: "Llamada", icon: Phone, color: "text-emerald-600 bg-emerald-500/10" },
  { value: "reunion", label: "Reunión", icon: Handshake, color: "text-amber-600 bg-amber-500/10" },
  { value: "otro", label: "Otro", icon: MoreHorizontal, color: "text-slate-600 bg-slate-500/10" },
];

function tipoMeta(t: string) {
  return TIPOS.find((x) => x.value === t) ?? TIPOS[0];
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlanSemanalPage() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const puedeVerTodos = isAdmin || isSupervisor;
  const [semanaBase, setSemanaBase] = useState<Date>(startOfWeek(new Date()));
  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [ejecutivoFiltro, setEjecutivoFiltro] = useState<string>("mi");
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [dialog, setDialog] = useState<{ open: boolean; fecha: Date | null; tipo: string; edit: Visita | null }>({
    open: false, fecha: null, tipo: "visita", edit: null,
  });
  const [vista, setVista] = useState<"semana" | "lista">("semana");

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: cs }] = await Promise.all([
        supabase.from("profiles").select("id, nombre").order("nombre"),
        supabase.from("clientes").select("id, razon_social, nombre_completo").order("razon_social").limit(500),
      ]);
      setEjecutivos((profs as Profile[]) ?? []);
      setClientes(
        (cs ?? []).map((c) => ({
          id: c.id,
          label: c.razon_social || c.nombre_completo || "Sin nombre",
        })),
      );
    })();
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const desde = ymd(semanaBase);
    const hasta = ymd(addDays(semanaBase, 6));
    let q = supabase
      .from("visitas_planificadas")
      .select("*, cliente:cliente_id(razon_social, nombre_completo, ciudad)")
      .gte("fecha_planificada", desde)
      .lte("fecha_planificada", hasta)
      .order("fecha_planificada");
    if (!puedeVerTodos || ejecutivoFiltro === "mi") {
      q = q.eq("ejecutivo_id", user.id);
    } else if (ejecutivoFiltro !== "todos") {
      q = q.eq("ejecutivo_id", ejecutivoFiltro);
    }
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setVisitas((data as Visita[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [semanaBase, ejecutivoFiltro, user?.id]);

  const byDay = useMemo(() => {
    const m: Record<string, Visita[]> = {};
    for (let i = 0; i < 7; i++) m[ymd(addDays(semanaBase, i))] = [];
    for (const v of visitas) {
      const k = v.fecha_planificada;
      if (m[k]) m[k].push(v);
    }
    return m;
  }, [visitas, semanaBase]);

  const totales = useMemo(() => {
    const r = { total: visitas.length, realizadas: 0, planificadas: 0, canceladas: 0, prospecciones: 0 };
    for (const v of visitas) {
      if (v.estado === "realizada") r.realizadas++;
      else if (v.estado === "planificada") r.planificadas++;
      else if (v.estado === "cancelada") r.canceladas++;
      if (v.tipo === "prospeccion") r.prospecciones++;
    }
    return r;
  }, [visitas]);

  const cambiarEstado = async (id: string, estado: Visita["estado"]) => {
    const { error } = await supabase.from("visitas_planificadas").update({ estado }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Actualizado");
    void load();
  };

  const eliminar = async (id: string) => {
    const { error } = await supabase.from("visitas_planificadas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-display">Plan Semanal</h1>
            <p className="text-sm text-muted-foreground">
              Agenda visitas, llamadas y reuniones. Las prospecciones se manejan en el módulo Prospecciones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={vista} onValueChange={(v) => setVista(v as "semana" | "lista")}>
            <TabsList>
              <TabsTrigger value="semana" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Semana</TabsTrigger>
              <TabsTrigger value="lista" className="gap-1.5"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          {puedeVerTodos && (
            <Select value={ejecutivoFiltro} onValueChange={setEjecutivoFiltro}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mi">Mis actividades</SelectItem>
                <SelectItem value="todos">Todos los ejecutivos</SelectItem>
                {ejecutivos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(addDays(semanaBase, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setSemanaBase(startOfWeek(new Date()))}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setSemanaBase(addDays(semanaBase, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => setDialog({ open: true, fecha: new Date(), tipo: "visita", edit: null })} className="gap-1.5">
            <Plus className="h-4 w-4" /> Nueva actividad
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Semana" value={`${semanaBase.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} → ${addDays(semanaBase, 6).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`} />
        <Kpi label="Actividades" value={totales.total} />
        <Kpi label="Visitas" value={visitas.filter((v) => v.tipo === "visita").length} tone="blue" />
        <Kpi label="Realizadas" value={totales.realizadas} tone="green" />
        <Kpi label="Pendientes" value={totales.planificadas} tone="violet" />
      </div>

      {vista === "semana" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {DAYS.map((label, i) => {
            const d = addDays(semanaBase, i);
            const key = ymd(d);
            const items = (byDay[key] ?? []).sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
            const isHoy = ymd(new Date()) === key;
            return (
              <div key={key} className={`rounded-lg border ${isHoy ? "border-primary ring-1 ring-primary/30" : ""}`}>
                <div className="p-2 border-b flex items-center justify-between bg-muted/30">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{DAYS_SHORT[i]}</p>
                    <p className="text-sm font-semibold">{d.getDate()}/{d.getMonth() + 1}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setDialog({ open: true, fecha: d, tipo: "visita", edit: null })}
                    title="Agregar actividad">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {loading ? (
                    <div className="text-xs text-muted-foreground">Cargando…</div>
                  ) : items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-4">Sin actividades</p>
                  ) : (
                    items.map((v) => (
                      <ActividadCard
                        key={v.id} v={v}
                        onChangeEstado={cambiarEstado}
                        onDelete={eliminar}
                        onEdit={() => setDialog({ open: true, fecha: new Date(v.fecha_planificada + "T00:00:00"), tipo: v.tipo, edit: v })}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">Cargando…</div>
            ) : visitas.length === 0 ? (
              <div className="p-10 text-sm text-muted-foreground text-center">
                Sin actividades esta semana. Empieza con <b>Nueva actividad</b>.
              </div>
            ) : (
              <div className="divide-y">
                {[...visitas]
                  .sort((a, b) => (a.fecha_planificada + (a.hora ?? "")).localeCompare(b.fecha_planificada + (b.hora ?? "")))
                  .map((v) => (
                    <ActividadRow key={v.id} v={v}
                      onChangeEstado={cambiarEstado}
                      onDelete={eliminar}
                      onEdit={() => setDialog({ open: true, fecha: new Date(v.fecha_planificada + "T00:00:00"), tipo: v.tipo, edit: v })}
                    />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ActividadDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}
        fecha={dialog.fecha}
        tipoInicial={dialog.tipo}
        edit={dialog.edit}
        clientes={clientes}
        ejecutivoId={
          puedeVerTodos && ejecutivoFiltro !== "mi" && ejecutivoFiltro !== "todos"
            ? ejecutivoFiltro
            : user?.id ?? ""
        }
        onSaved={() => { setDialog({ open: false, fecha: null, tipo: "visita", edit: null }); void load(); }}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "green" | "blue" | "violet" }) {
  const color =
    tone === "green" ? "text-green-600"
    : tone === "blue" ? "text-primary"
    : tone === "violet" ? "text-violet-600"
    : "";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ActividadCard({
  v, onChangeEstado, onDelete, onEdit,
}: {
  v: Visita;
  onChangeEstado: (id: string, estado: Visita["estado"]) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const meta = tipoMeta(v.tipo);
  const Icon = meta.icon;
  const badgeVariant =
    v.estado === "realizada" ? "default" :
    v.estado === "cancelada" ? "destructive" :
    v.estado === "reprogramada" ? "secondary" : "outline";
  const cliNombre = v.cliente?.razon_social || v.cliente?.nombre_completo || "Cliente";
  return (
    <div className="rounded-md border bg-background p-2 space-y-1.5 text-xs hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-1.5">
        <div className={`h-6 w-6 rounded grid place-items-center shrink-0 ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <button onClick={onEdit} className="font-medium leading-snug truncate block text-left hover:underline w-full">
            {cliNombre}
          </button>
          <p className="text-[10px] text-muted-foreground truncate">
            {v.hora ? v.hora.slice(0, 5) + " · " : ""}{meta.label}
          </p>
        </div>
        <Badge variant={badgeVariant} className="text-[9px] shrink-0 h-4">{v.estado}</Badge>
      </div>
      {v.motivo && <p className="text-muted-foreground line-clamp-2">{v.motivo}</p>}
      {v.logro && (
        <p className="text-emerald-700 dark:text-emerald-400 line-clamp-2">
          <b>Logré:</b> {v.logro}
        </p>
      )}
      {v.proxima_accion && (
        <p className="text-primary line-clamp-2">
          <b>Próx:</b> {v.proxima_accion}
          {v.proxima_accion_fecha ? ` (${v.proxima_accion_fecha})` : ""}
        </p>
      )}
      <div className="flex items-center gap-0.5 pt-0.5">
        {v.estado !== "realizada" && (
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Marcar realizada"
            onClick={() => onChangeEstado(v.id, "realizada")}>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </Button>
        )}
        {v.estado !== "planificada" && (
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Reabrir"
            onClick={() => onChangeEstado(v.id, "planificada")}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {v.estado !== "cancelada" && (
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Cancelar"
            onClick={() => onChangeEstado(v.id, "cancelada")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-destructive"
          onClick={() => onDelete(v.id)} title="Eliminar">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ActividadRow({
  v, onChangeEstado, onDelete, onEdit,
}: {
  v: Visita;
  onChangeEstado: (id: string, estado: Visita["estado"]) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
}) {
  const meta = tipoMeta(v.tipo);
  const Icon = meta.icon;
  const cliNombre = v.cliente?.razon_social || v.cliente?.nombre_completo || "Cliente";
  const fechaTxt = new Date(v.fecha_planificada + "T00:00:00").toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="flex items-start gap-3 p-3 hover:bg-muted/30">
      <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onEdit} className="font-medium text-sm hover:underline text-left truncate">{cliNombre}</button>
          <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {fechaTxt}{v.hora ? ` · ${v.hora.slice(0, 5)}` : ""}
          </span>
          <Badge className="text-[10px] ml-auto" variant={
            v.estado === "realizada" ? "default" : v.estado === "cancelada" ? "destructive" : "outline"
          }>{v.estado}</Badge>
        </div>
        {(v.motivo || v.detalles) && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {[v.motivo, v.detalles].filter(Boolean).join(" · ")}
          </p>
        )}
        {v.logro && <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5"><b>Logré:</b> {v.logro}</p>}
        {v.proxima_accion && (
          <p className="text-xs text-primary mt-0.5">
            <b>Próxima acción:</b> {v.proxima_accion}{v.proxima_accion_fecha ? ` (${v.proxima_accion_fecha})` : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {v.estado !== "realizada" && (
          <Button size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => onChangeEstado(v.id, "realizada")} title="Marcar realizada">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
          onClick={() => onDelete(v.id)} title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ActividadDialog({
  open, onOpenChange, fecha, tipoInicial, edit, clientes, ejecutivoId, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fecha: Date | null;
  tipoInicial: string;
  edit: Visita | null;
  clientes: ClienteLite[];
  ejecutivoId: string;
  onSaved: () => void;
}) {
  const [clienteId, setClienteId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("visita");
  const [motivo, setMotivo] = useState("");
  const [detalles, setDetalles] = useState("");
  const [logro, setLogro] = useState("");
  const [proximaAccion, setProximaAccion] = useState("");
  const [proximaFecha, setProximaFecha] = useState("");
  const [hora, setHora] = useState("");
  const [fechaStr, setFechaStr] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setClienteId(edit.cliente_id);
      setTipo(edit.tipo);
      setMotivo(edit.motivo ?? "");
      setDetalles(edit.detalles ?? "");
      setLogro(edit.logro ?? "");
      setProximaAccion(edit.proxima_accion ?? "");
      setProximaFecha(edit.proxima_accion_fecha ?? "");
      setHora(edit.hora ?? "");
      setFechaStr(edit.fecha_planificada);
    } else {
      setClienteId("");
      setTipo(tipoInicial || "visita");
      setMotivo(""); setDetalles(""); setLogro("");
      setProximaAccion(""); setProximaFecha("");
      setHora("");
      setFechaStr(fecha ? ymd(fecha) : ymd(new Date()));
    }
  }, [open, edit, tipoInicial, fecha]);

  const clienteLabel = clientes.find((c) => c.id === clienteId)?.label ?? "Selecciona cliente…";

  const save = async () => {
    if (!clienteId) return toast.error("Selecciona el cliente");
    if (!fechaStr) return toast.error("Elige una fecha");
    setSaving(true);
    const payload = {
      cliente_id: clienteId,
      ejecutivo_id: ejecutivoId,
      fecha_planificada: fechaStr,
      hora: hora || null,
      tipo,
      motivo: motivo || null,
      detalles: detalles || null,
      logro: logro || null,
      proxima_accion: proximaAccion || null,
      proxima_accion_fecha: proximaFecha || null,
    };
    const q = edit
      ? supabase.from("visitas_planificadas").update(payload).eq("id", edit.id)
      : supabase.from("visitas_planificadas").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Actualizada" : "Agendada");
    // Si se registró un logro, replicar como seguimiento del cliente para que se vea en la ficha
    if (!edit && logro.trim()) {
      const tipoMap: Record<string, string> = {
        visita: "visita", prospeccion: "otro", llamada: "llamada", reunion: "reunion", otro: "otro",
      };
      await supabase.from("seguimientos").insert({
        cliente_id: clienteId,
        usuario_id: ejecutivoId,
        tipo: tipoMap[tipo] as never,
        fecha: fechaStr + "T09:00:00Z",
        resultado: logro,
        proxima_accion_fecha: proximaFecha || null,
        proxima_accion_nota: proximaAccion || null,
      });
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
          <DialogDescription>
            Registra visitas, llamadas o reuniones con el detalle completo del contacto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1">
            {TIPOS.map((t) => {
              const I = t.icon;
              const active = tipo === t.value;
              return (
                <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                  className={`rounded-md border p-2 text-[11px] flex flex-col items-center gap-1 transition ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <I className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div>
            <Label>Cliente *</Label>
            <Popover open={popOpen} onOpenChange={setPopOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{clienteLabel}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar cliente…" />
                  <CommandList>
                    <CommandEmpty>
                      Sin resultados. <Link to="/clientes/nuevo" className="text-primary hover:underline">Crear cliente</Link>
                    </CommandEmpty>
                    <CommandGroup>
                      {clientes.map((c) => (
                        <CommandItem key={c.id} value={c.label} onSelect={() => {
                          setClienteId(c.id); setPopOpen(false);
                        }}>
                          <CheckIcon className={`h-4 w-4 mr-2 ${clienteId === c.id ? "opacity-100" : "opacity-0"}`} />
                          {c.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {tipo === "prospeccion" && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> Si es un prospecto nuevo, créalo primero en Clientes con estado <b>Prospecto</b>.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={fechaStr} onChange={(e) => setFechaStr(e.target.value)} />
            </div>
            <div>
              <Label>Hora (opcional)</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Motivo / objetivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Presentar propuesta, cierre de tarifa…" />
          </div>

          <div>
            <Label>Detalles</Label>
            <Textarea value={detalles} onChange={(e) => setDetalles(e.target.value)} rows={2}
              placeholder="Contexto, contacto, dirección, temas a tratar…" />
          </div>

          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <Label className="text-emerald-700 dark:text-emerald-400">¿Qué logré? (después de la actividad)</Label>
            <Textarea value={logro} onChange={(e) => setLogro(e.target.value)} rows={2}
              placeholder="Resumen del resultado. Se registrará también como seguimiento del cliente." />
          </div>

          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <Label className="text-primary">Próxima acción</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input className="col-span-2" value={proximaAccion} onChange={(e) => setProximaAccion(e.target.value)}
                placeholder="Ej: Enviar cotización revisada" />
              <Input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{edit ? "Guardar" : "Agendar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}