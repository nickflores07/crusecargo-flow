import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Plus, Target, GripVertical, Trophy, XCircle, Clock, Pencil, Check, ChevronsUpDown, Weight, AlertCircle, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { RegistrarContactoDialog } from "@/components/mi-dia/registrar-contacto-dialog";
import { ProgramarActividadDialog } from "@/components/prospecciones/programar-actividad-dialog";
import { CalendarPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/oportunidades")({
  component: OportunidadesPage,
});

type EstadoOp = "en_proceso" | "ganada" | "perdida";

type Oport = {
  id: string;
  cliente_id: string;
  titulo: string;
  servicio: string | null;
  monto_potencial: number | null;
  peso_estimado_kg: number | null;
  probabilidad: number;
  fecha_cierre_estimada: string | null;
  estado: EstadoOp;
  motivo_perdida: string | null;
  notas: string | null;
  cliente_nombre: string;
  cliente_estado: string | null;
  updated_at: string;
};

type UltimoSeguimiento = {
  cliente_id: string;
  tipo: string;
  fecha: string;
  resultado: string | null;
  proxima_accion_fecha: string | null;
  proxima_accion_nota: string | null;
};

type ProximaActividad = {
  oportunidad_id: string;
  id: string;
  fecha_planificada: string;
  hora: string | null;
  tipo: string;
  motivo: string | null;
};

type ClienteOpt = { id: string; label: string };

const COLS: Array<{ estado: EstadoOp; title: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = [
  { estado: "en_proceso", title: "En proceso", icon: Clock, accent: "border-blue-500/40" },
  { estado: "ganada", title: "Ganada", icon: Trophy, accent: "border-green-500/40" },
  { estado: "perdida", title: "Perdida", icon: XCircle, accent: "border-red-500/40" },
];

function fmtMoney(n: number | null) {
  if (n == null) return "—";
  return "S/ " + n.toLocaleString("es-PE", { maximumFractionDigits: 2 });
}

type FormState = {
  cliente_id: string;
  titulo: string;
  servicio: string;
  monto: string;
  peso: string;
  probabilidad: number;
  fecha_cierre: string;
  notas: string;
};

const emptyForm: FormState = {
  cliente_id: "", titulo: "", servicio: "", monto: "", peso: "",
  probabilidad: 50, fecha_cierre: "", notas: "",
};

function ClienteCombobox({
  clientes, value, onChange,
}: { clientes: ClienteOpt[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = clientes.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : "Busca un cliente por nombre…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(val, search) => {
            // val is the CommandItem value; we store the label lowercased there
            return val.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Escribe parte del nombre…" />
          <CommandList>
            <CommandEmpty>Sin coincidencias. Crea el cliente primero en el módulo Clientes.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.label.toLowerCase()}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                >
                  <Check className={cn("h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{c.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OportunidadesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Oport[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [dragged, setDragged] = useState<Oport | null>(null);
  const [soloStale, setSoloStale] = useState(false);
  const [motivoDialog, setMotivoDialog] = useState<{ open: boolean; oport: Oport | null; motivo: string }>({
    open: false, oport: null, motivo: "",
  });
  const [segByCliente, setSegByCliente] = useState<Record<string, UltimoSeguimiento>>({});
  const [contactoDialog, setContactoDialog] = useState<Oport | null>(null);
  const [actByOp, setActByOp] = useState<Record<string, ProximaActividad>>({});
  const [programarDialog, setProgramarDialog] = useState<Oport | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oportunidades")
      .select(`id, cliente_id, titulo, servicio, monto_potencial, peso_estimado_kg, probabilidad, fecha_cierre_estimada, estado, motivo_perdida, notas, updated_at,
               clientes ( razon_social, nombre_completo, estado )`)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No pudimos cargar las oportunidades");
      setLoading(false);
      return;
    }
    const mapped: Oport[] = (data ?? []).map((r) => {
      const c = (r as unknown as { clientes: { razon_social: string | null; nombre_completo: string | null; estado: string | null } | null }).clientes;
      return {
        id: r.id, cliente_id: r.cliente_id, titulo: r.titulo, servicio: r.servicio,
        monto_potencial: r.monto_potencial as number | null,
        peso_estimado_kg: (r as { peso_estimado_kg: number | null }).peso_estimado_kg,
        probabilidad: r.probabilidad, fecha_cierre_estimada: r.fecha_cierre_estimada,
        estado: r.estado as EstadoOp, motivo_perdida: r.motivo_perdida,
        notas: r.notas ?? null,
        cliente_nombre: c?.razon_social || c?.nombre_completo || "Cliente",
        cliente_estado: c?.estado ?? null,
        updated_at: (r as { updated_at: string }).updated_at,
      };
    });
    setItems(mapped);

    // Cargar el último seguimiento por cliente (para mostrar "Última acción" y "Próxima acción" en cada tarjeta)
    const clienteIds = Array.from(new Set(mapped.map((m) => m.cliente_id)));
    if (clienteIds.length > 0) {
      const { data: segs } = await supabase
        .from("seguimientos")
        .select("cliente_id, tipo, fecha, resultado, proxima_accion_fecha, proxima_accion_nota")
        .in("cliente_id", clienteIds)
        .order("fecha", { ascending: false });
      const map: Record<string, UltimoSeguimiento> = {};
      (segs ?? []).forEach((s) => {
        if (!map[s.cliente_id]) map[s.cliente_id] = s as UltimoSeguimiento;
      });
      setSegByCliente(map);
    } else {
      setSegByCliente({});
    }

    // Próximas actividades programadas por oportunidad
    const opIds = mapped.filter((m) => m.estado === "en_proceso").map((m) => m.id);
    if (opIds.length > 0) {
      const hoyIso = new Date().toISOString().slice(0, 10);
      const { data: acts } = await supabase
        .from("visitas_planificadas")
        .select("id, oportunidad_id, fecha_planificada, hora, tipo, motivo")
        .in("oportunidad_id", opIds)
        .eq("estado", "planificada")
        .gte("fecha_planificada", hoyIso)
        .order("fecha_planificada", { ascending: true })
        .order("hora", { ascending: true });
      const amap: Record<string, ProximaActividad> = {};
      (acts ?? []).forEach((a) => {
        if (a.oportunidad_id && !amap[a.oportunidad_id]) {
          amap[a.oportunidad_id] = a as ProximaActividad;
        }
      });
      setActByOp(amap);
    } else {
      setActByOp({});
    }
    setLoading(false);
  };

  const loadClientes = async () => {
    const { data } = await supabase.from("clientes")
      .select("id, razon_social, nombre_completo").order("created_at", { ascending: false });
    setClientes((data ?? []).map((c) => ({
      id: c.id,
      label: c.razon_social || c.nombre_completo || "(sin nombre)",
    })));
  };

  useEffect(() => { void load(); void loadClientes(); }, []);

  const grouped = useMemo(() => {
    const g: Record<EstadoOp, Oport[]> = { en_proceso: [], ganada: [], perdida: [] };
    const cutoff = Date.now() - 7 * 86400000;
    const list = soloStale
      ? items.filter((o) => o.estado === "en_proceso" && new Date(o.updated_at).getTime() < cutoff)
      : items;
    list.forEach((o) => g[o.estado].push(o));
    return g;
  }, [items, soloStale]);

  const staleCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return items.filter((o) => o.estado === "en_proceso" && new Date(o.updated_at).getTime() < cutoff).length;
  }, [items]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing({ open: true, id: null });
  };

  const openEdit = (o: Oport) => {
    setForm({
      cliente_id: o.cliente_id,
      titulo: o.titulo,
      servicio: o.servicio ?? "",
      monto: o.monto_potencial != null ? String(o.monto_potencial) : "",
      peso: o.peso_estimado_kg != null ? String(o.peso_estimado_kg) : "",
      probabilidad: o.probabilidad,
      fecha_cierre: o.fecha_cierre_estimada ?? "",
      notas: o.notas ?? "",
    });
    setEditing({ open: true, id: o.id });
  };

  const save = async () => {
    if (!form.cliente_id) return toast.error("Selecciona el cliente");
    if (!form.titulo.trim()) return toast.error("Ponle un título a la oportunidad");
    setSaving(true);
    const payload = {
      cliente_id: form.cliente_id,
      titulo: form.titulo.trim(),
      servicio: form.servicio || null,
      monto_potencial: form.monto ? Number(form.monto) : null,
      peso_estimado_kg: form.peso ? Number(form.peso) : null,
      probabilidad: form.probabilidad,
      fecha_cierre_estimada: form.fecha_cierre || null,
      notas: form.notas || null,
    };
    const { error } = editing.id
      ? await supabase.from("oportunidades").update(payload).eq("id", editing.id)
      : await supabase.from("oportunidades").insert({
          ...payload,
          ejecutivo_id: user?.id ?? null,
          created_by: user?.id ?? null,
        });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar: " + error.message);
    toast.success(editing.id ? "Prospecto actualizado" : "Prospecto creado");
    setEditing({ open: false, id: null });
    setForm(emptyForm);
    void load();
  };

  const moverA = async (op: Oport, nuevo: EstadoOp, motivo?: string) => {
    if (op.estado === nuevo) return;
    const patch: { estado: EstadoOp; motivo_perdida?: string | null } = { estado: nuevo };
    if (nuevo === "perdida") patch.motivo_perdida = motivo ?? "";
    else patch.motivo_perdida = null;
    // Optimistic update
    setItems((prev) => prev.map((x) => (x.id === op.id ? { ...x, estado: nuevo, motivo_perdida: patch.motivo_perdida ?? null } : x)));
    const { error } = await supabase.from("oportunidades").update(patch).eq("id", op.id);
    if (error) {
      toast.error("No se pudo mover: " + error.message);
      void load();
      return;
    }
    toast.success(nuevo === "ganada" ? "¡Prospecto ganado! 🎉" : nuevo === "perdida" ? "Marcada como perdida" : "Actualizada");
  };

  const handleDrop = (col: EstadoOp) => {
    if (!dragged) return;
    if (col === "perdida") {
      setMotivoDialog({ open: true, oport: dragged, motivo: dragged.motivo_perdida ?? "" });
    } else {
      void moverA(dragged, col);
    }
    setDragged(null);
  };

  const confirmarPerdida = async () => {
    if (!motivoDialog.oport) return;
    if (!motivoDialog.motivo.trim()) return toast.error("El motivo es obligatorio para marcar como perdida.");
    await moverA(motivoDialog.oport, "perdida", motivoDialog.motivo.trim());
    setMotivoDialog({ open: false, oport: null, motivo: "" });
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Target className="h-6 w-6" /> Prospecciones</h1>
          <p className="text-sm text-muted-foreground">Cada prospecto tiene su historial de contactos y próxima acción. Arrastra entre columnas para actualizar su estado.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={soloStale ? "default" : "outline"}
            size="sm"
            onClick={() => setSoloStale((v) => !v)}
            className="gap-1.5"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Sin actividad {">"}7d
            <Badge variant="secondary" className="text-[10px] ml-1">{staleCount}</Badge>
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nuevo prospecto</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLS.map((col) => {
            const list = grouped[col.estado];
            const total = list.reduce((s, o) => s + (o.monto_potencial ?? 0), 0);
            const Icon = col.icon;
            return (
              <div
                key={col.estado}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.estado)}
                className={`rounded-lg border-2 border-dashed ${col.accent} bg-muted/20 p-3 min-h-[300px]`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <h3 className="font-semibold text-sm">{col.title}</h3>
                    <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtMoney(total)}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Suelta aquí</p>
                  )}
                  {list.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDragged(o)}
                      className="group rounded-md border bg-background p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <Link to="/clientes/$id" params={{ id: o.cliente_id }} className="text-xs text-primary hover:underline truncate block">
                              {o.cliente_nombre}
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEdit(o); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              draggable={false}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                              aria-label="Editar oportunidad"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="font-medium text-sm truncate mt-0.5">{o.titulo}</p>
                          {o.servicio && <p className="text-xs text-muted-foreground truncate">{o.servicio}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-semibold">{fmtMoney(o.monto_potencial)}</span>
                            <Badge variant="outline" className="text-[10px]">{o.probabilidad}%</Badge>
                          </div>
                          {o.peso_estimado_kg != null && (
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Weight className="h-3 w-3" /> {o.peso_estimado_kg.toLocaleString("es-PE")} Kg
                            </p>
                          )}
                          {o.fecha_cierre_estimada && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Cierre: {new Date(o.fecha_cierre_estimada).toLocaleDateString("es-PE")}
                            </p>
                          )}
                          {o.estado === "perdida" && o.motivo_perdida && (
                            <p className="text-[11px] text-red-600 mt-1">Motivo: {o.motivo_perdida}</p>
                          )}
                          {o.estado === "en_proceso" && (() => {
                            const dias = Math.round((Date.now() - new Date(o.updated_at).getTime()) / 86400000);
                            if (dias < 7) return null;
                            return (
                              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Sin actividad {dias}d
                              </p>
                            );
                          })()}
                          {o.estado === "en_proceso" && (
                            <SeguimientoBlock
                              ultimo={segByCliente[o.cliente_id]}
                              probabilidad={o.probabilidad}
                              fechaCierre={o.fecha_cierre_estimada}
                              proxima={actByOp[o.id]}
                              onRegistrar={() => setContactoDialog(o)}
                              onProgramar={() => setProgramarDialog(o)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {contactoDialog && (
        <RegistrarContactoDialog
          clienteId={contactoDialog.cliente_id}
          clienteNombre={contactoDialog.cliente_nombre}
          estadoCliente={contactoDialog.cliente_estado}
          open={!!contactoDialog}
          onOpenChange={(v) => !v && setContactoDialog(null)}
          onSaved={() => void load()}
        />
      )}

      {/* Dialog: crear / editar oportunidad */}
      <Dialog open={editing.open} onOpenChange={(o) => setEditing((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar prospecto" : "Nuevo prospecto"}</DialogTitle>
            <DialogDescription>
              {editing.id ? "Actualiza los datos de este prospecto." : "Registra un prospecto para dar seguimiento y ver su trazabilidad."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <ClienteCombobox
                clientes={clientes}
                value={form.cliente_id}
                onChange={(id) => setForm((s) => ({ ...s, cliente_id: id }))}
              />
              {clientes.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aún no tienes clientes. Créalos primero en <Link to="/clientes" className="text-primary hover:underline">Clientes</Link>.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Título del prospecto *</Label>
              <Input value={form.titulo} onChange={(e) => setForm((s) => ({ ...s, titulo: e.target.value }))}
                placeholder="Ej: Contrato mensual envíos Lima" />
            </div>
            <div>
              <Label className="text-xs">Servicio de interés</Label>
              <Input value={form.servicio} onChange={(e) => setForm((s) => ({ ...s, servicio: e.target.value }))}
                placeholder="Ej: Última milla, courier documentario..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Monto (S/)</Label>
                <Input type="number" step="0.01" min={0} value={form.monto}
                  onChange={(e) => setForm((s) => ({ ...s, monto: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Peso estimado (Kg)</Label>
                <Input type="number" step="0.01" min={0} value={form.peso}
                  onChange={(e) => setForm((s) => ({ ...s, peso: e.target.value }))}
                  placeholder="Ej: 250" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Probabilidad %</Label>
                <Input type="number" min={0} max={100} value={form.probabilidad}
                  onChange={(e) => setForm((s) => ({ ...s, probabilidad: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} />
              </div>
              <div>
                <Label className="text-xs">Cierre estimado</Label>
                <Input type="date" value={form.fecha_cierre}
                  onChange={(e) => setForm((s) => ({ ...s, fecha_cierre: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas</Label>
              <Textarea rows={2} value={form.notas}
                onChange={(e) => setForm((s) => ({ ...s, notas: e.target.value }))}
                placeholder="Detalles internos, próximos pasos…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing({ open: false, id: null })}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editing.id ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: motivo perdida */}
      <Dialog open={motivoDialog.open} onOpenChange={(o) => setMotivoDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo de pérdida</DialogTitle>
            <DialogDescription>Indica por qué no se concretó la venta. Es obligatorio.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={motivoDialog.motivo}
            onChange={(e) => setMotivoDialog((s) => ({ ...s, motivo: e.target.value }))}
            placeholder="Ej: Precio no competitivo, eligieron otra courier..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotivoDialog({ open: false, oport: null, motivo: "" })}>Cancelar</Button>
            <Button onClick={confirmarPerdida}>Marcar como perdida</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SeguimientoBlock({
  ultimo, probabilidad, fechaCierre, proxima, onRegistrar, onProgramar,
}: {
  ultimo: UltimoSeguimiento | undefined;
  probabilidad: number;
  fechaCierre: string | null;
  proxima?: ProximaActividad;
  onRegistrar: () => void;
  onProgramar: () => void;
}) {
  const fmtFecha = (s: string) => new Date(s).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  const diasSinContacto = ultimo ? Math.round((Date.now() - new Date(ultimo.fecha).getTime()) / 86400000) : null;

  // Recomendación heurística ("IA sugiere") basada en actividad, probabilidad y fecha de cierre.
  const sugerencia = (() => {
    if (!ultimo) return "Primer contacto: agenda una llamada de descubrimiento y valida presupuesto.";
    const d = diasSinContacto ?? 0;
    const cierreDias = fechaCierre
      ? Math.round((new Date(fechaCierre + "T00:00:00").getTime() - Date.now()) / 86400000)
      : null;
    if (cierreDias !== null && cierreDias <= 3 && probabilidad >= 60) {
      return "Cierre inminente: envía propuesta final y agenda cita de firma esta semana.";
    }
    if (d > 14) return "Reactiva contacto: han pasado más de 2 semanas. Envía novedades o pregunta por decisión.";
    if (d > 7) return "Da seguimiento: agenda una llamada esta semana para conocer el estatus.";
    if (probabilidad < 30) return "Califica mejor: valida presupuesto, decisor y timing antes de invertir más tiempo.";
    if (probabilidad >= 70) return "Empuja al cierre: envía cotización o propuesta formal y pide confirmación.";
    return "Mantén cadencia: reunión de seguimiento o envío de propuesta.";
  })();

  return (
    <div className="mt-2 pt-2 border-t space-y-1.5">
      {proxima && (
        <div className="flex items-start gap-1.5 text-[11px] bg-primary/5 border border-primary/20 rounded px-1.5 py-1">
          <CalendarPlus className="h-3 w-3 mt-0.5 text-primary shrink-0" />
          <p className="line-clamp-2">
            <b className="text-primary capitalize">{proxima.tipo.replace("_", " ")}</b>{" "}
            {fmtFecha(proxima.fecha_planificada)}{proxima.hora ? ` · ${proxima.hora.slice(0, 5)}` : ""}
            {proxima.motivo ? ` — ${proxima.motivo}` : ""}
          </p>
        </div>
      )}
      {ultimo ? (
        <>
          <div className="flex items-start gap-1.5 text-[11px]">
            <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground">
                <b>Última ({ultimo.tipo}, {fmtFecha(ultimo.fecha)}):</b>
              </p>
              <p className="line-clamp-2">{ultimo.resultado || "—"}</p>
            </div>
          </div>
          {ultimo.proxima_accion_nota && (
            <div className="flex items-start gap-1.5 text-[11px] text-primary">
              <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
              <p className="line-clamp-2">
                <b>Próx{ultimo.proxima_accion_fecha ? ` ${fmtFecha(ultimo.proxima_accion_fecha)}` : ""}:</b> {ultimo.proxima_accion_nota}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Sin contactos registrados aún.</p>
      )}
      <div className="flex items-start gap-1.5 text-[11px] text-violet-700 dark:text-violet-400 bg-violet-500/5 rounded p-1.5">
        <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
        <p className="line-clamp-2"><b>IA sugiere:</b> {sugerencia}</p>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onProgramar(); }}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          className="text-[11px] text-primary hover:underline flex items-center gap-1"
        >
          <CalendarPlus className="h-3 w-3" /> Programar actividad
        </button>
        <span className="text-muted-foreground text-[11px]">·</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRegistrar(); }}
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
          className="text-[11px] text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Registrar contacto
        </button>
      </div>
    </div>
  );
}