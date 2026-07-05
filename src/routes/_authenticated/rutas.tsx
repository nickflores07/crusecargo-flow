import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Map, Plus, CheckCircle2, X, ChevronLeft, ChevronRight, RotateCcw, Check as CheckIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rutas")({
  component: RutasPage,
});

type Visita = {
  id: string;
  ejecutivo_id: string;
  cliente_id: string;
  fecha_planificada: string;
  motivo: string | null;
  estado: "planificada" | "realizada" | "reprogramada" | "cancelada";
  resultado: string | null;
  notas: string | null;
  cliente?: { razon_social: string | null; nombre_completo: string | null; ciudad: string | null } | null;
};

type ClienteLite = { id: string; label: string };
type Profile = { id: string; nombre: string };

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

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

function RutasPage() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const puedeVerTodos = isAdmin || isSupervisor;
  const [semanaBase, setSemanaBase] = useState<Date>(startOfWeek(new Date()));
  const [ejecutivos, setEjecutivos] = useState<Profile[]>([]);
  const [ejecutivoFiltro, setEjecutivoFiltro] = useState<string>("mi");
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [openNew, setOpenNew] = useState<Date | null>(null);

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
    const r = { total: visitas.length, realizadas: 0, planificadas: 0, canceladas: 0 };
    for (const v of visitas) {
      if (v.estado === "realizada") r.realizadas++;
      else if (v.estado === "planificada") r.planificadas++;
      else if (v.estado === "cancelada") r.canceladas++;
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
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold font-display">Rutas comerciales</h1>
            <p className="text-sm text-muted-foreground">Planifica tu semana de visitas a clientes.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeVerTodos && (
            <Select value={ejecutivoFiltro} onValueChange={setEjecutivoFiltro}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mi">Mis visitas</SelectItem>
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
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Semana" value={`${semanaBase.toLocaleDateString()} → ${addDays(semanaBase, 6).toLocaleDateString()}`} />
        <Kpi label="Total visitas" value={totales.total} />
        <Kpi label="Realizadas" value={totales.realizadas} tone="green" />
        <Kpi label="Pendientes" value={totales.planificadas} tone="blue" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {DAYS.map((label, i) => {
          const d = addDays(semanaBase, i);
          const key = ymd(d);
          const items = byDay[key] ?? [];
          const isHoy = ymd(new Date()) === key;
          return (
            <div key={key} className={`rounded-lg border ${isHoy ? "border-primary" : ""}`}>
              <div className="p-2 border-b flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium">{d.getDate()}/{d.getMonth() + 1}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setOpenNew(d)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-2 space-y-2 min-h-[100px]">
                {loading ? (
                  <div className="text-xs text-muted-foreground">Cargando…</div>
                ) : items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Sin visitas</p>
                ) : (
                  items.map((v) => (
                    <VisitaCard
                      key={v.id}
                      v={v}
                      onChangeEstado={cambiarEstado}
                      onDelete={eliminar}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <NewVisitaDialog
        open={openNew !== null}
        onOpenChange={(o) => !o && setOpenNew(null)}
        fecha={openNew}
        clientes={clientes}
        ejecutivoId={
          puedeVerTodos && ejecutivoFiltro !== "mi" && ejecutivoFiltro !== "todos"
            ? ejecutivoFiltro
            : user?.id ?? ""
        }
        onCreated={() => { setOpenNew(null); void load(); }}
      />
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "green" | "blue" }) {
  const color = tone === "green" ? "text-green-600" : tone === "blue" ? "text-primary" : "";
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function VisitaCard({
  v, onChangeEstado, onDelete,
}: {
  v: Visita;
  onChangeEstado: (id: string, estado: Visita["estado"]) => void;
  onDelete: (id: string) => void;
}) {
  const badgeVariant =
    v.estado === "realizada" ? "default" :
    v.estado === "cancelada" ? "destructive" :
    v.estado === "reprogramada" ? "secondary" : "outline";
  return (
    <div className="rounded-md border p-2 space-y-1 text-xs">
      <div className="flex items-start justify-between gap-1">
        <p className="font-medium leading-snug truncate">
          {v.cliente?.razon_social || v.cliente?.nombre_completo || "Cliente"}
        </p>
        <Badge variant={badgeVariant} className="text-[10px] shrink-0">{v.estado}</Badge>
      </div>
      {v.cliente?.ciudad && (
        <p className="text-muted-foreground truncate">{v.cliente.ciudad}</p>
      )}
      {v.motivo && <p className="text-muted-foreground line-clamp-2">{v.motivo}</p>}
      <div className="flex items-center gap-1 pt-1">
        {v.estado !== "realizada" && (
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Marcar realizada"
            onClick={() => onChangeEstado(v.id, "realizada")}>
            <CheckCircle2 className="h-3.5 w-3.5" />
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
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NewVisitaDialog({
  open, onOpenChange, fecha, clientes, ejecutivoId, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fecha: Date | null;
  clientes: ClienteLite[];
  ejecutivoId: string;
  onCreated: () => void;
}) {
  const [clienteId, setClienteId] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [popOpen, setPopOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) { setClienteId(""); setMotivo(""); } }, [open]);

  const clienteLabel = clientes.find((c) => c.id === clienteId)?.label ?? "Selecciona cliente…";

  const save = async () => {
    if (!clienteId || !fecha || !ejecutivoId) return;
    setSaving(true);
    const { error } = await supabase.from("visitas_planificadas").insert({
      ejecutivo_id: ejecutivoId,
      cliente_id: clienteId,
      fecha_planificada: ymd(fecha),
      motivo: motivo || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Visita agendada");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva visita</DialogTitle>
          <DialogDescription>
            {fecha ? fecha.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }) : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente</Label>
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
                    <CommandEmpty>Sin resultados</CommandEmpty>
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
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              placeholder="Ej: Cierre de propuesta, presentación de tarifa…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!clienteId || saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}