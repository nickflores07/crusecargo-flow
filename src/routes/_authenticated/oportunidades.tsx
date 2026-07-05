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
import { Loader2, Plus, Target, GripVertical, Trophy, XCircle, Clock, Pencil, Check, ChevronsUpDown, Weight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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
  updated_at: string;
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oportunidades")
      .select(`id, cliente_id, titulo, servicio, monto_potencial, peso_estimado_kg, probabilidad, fecha_cierre_estimada, estado, motivo_perdida, notas, updated_at,
               clientes ( razon_social, nombre_completo )`)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("No pudimos cargar las oportunidades");
      setLoading(false);
      return;
    }
    const mapped: Oport[] = (data ?? []).map((r) => {
      const c = (r as unknown as { clientes: { razon_social: string | null; nombre_completo: string | null } | null }).clientes;
      return {
        id: r.id, cliente_id: r.cliente_id, titulo: r.titulo, servicio: r.servicio,
        monto_potencial: r.monto_potencial as number | null,
        peso_estimado_kg: (r as { peso_estimado_kg: number | null }).peso_estimado_kg,
        probabilidad: r.probabilidad, fecha_cierre_estimada: r.fecha_cierre_estimada,
        estado: r.estado as EstadoOp, motivo_perdida: r.motivo_perdida,
        notas: r.notas ?? null,
        cliente_nombre: c?.razon_social || c?.nombre_completo || "Cliente",
        updated_at: (r as { updated_at: string }).updated_at,
      };
    });
    setItems(mapped);
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
    toast.success(editing.id ? "Oportunidad actualizada" : "Oportunidad creada");
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
    toast.success(nuevo === "ganada" ? "¡Oportunidad ganada! 🎉" : nuevo === "perdida" ? "Marcada como perdida" : "Actualizada");
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Target className="h-6 w-6" /> Oportunidades</h1>
          <p className="text-sm text-muted-foreground">Arrastra las tarjetas entre columnas o toca el lápiz para editar cada oportunidad.</p>
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
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Nueva oportunidad</Button>
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

      {/* Dialog: crear / editar oportunidad */}
      <Dialog open={editing.open} onOpenChange={(o) => setEditing((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle>
            <DialogDescription>
              {editing.id ? "Actualiza los datos de esta oportunidad." : "Registra una posible venta para dar seguimiento."}
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
              <Label className="text-xs">Título *</Label>
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