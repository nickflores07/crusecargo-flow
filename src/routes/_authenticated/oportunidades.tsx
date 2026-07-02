import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Plus, Target, GripVertical, Trophy, XCircle, Clock } from "lucide-react";
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
  probabilidad: number;
  fecha_cierre_estimada: string | null;
  estado: EstadoOp;
  motivo_perdida: string | null;
  cliente_nombre: string;
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

function OportunidadesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Oport[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cliente_id: "", titulo: "", servicio: "", monto: "", probabilidad: 50, fecha_cierre: "",
  });
  const [dragged, setDragged] = useState<Oport | null>(null);
  const [motivoDialog, setMotivoDialog] = useState<{ open: boolean; oport: Oport | null; motivo: string }>({
    open: false, oport: null, motivo: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oportunidades")
      .select(`id, cliente_id, titulo, servicio, monto_potencial, probabilidad, fecha_cierre_estimada, estado, motivo_perdida,
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
        probabilidad: r.probabilidad, fecha_cierre_estimada: r.fecha_cierre_estimada,
        estado: r.estado as EstadoOp, motivo_perdida: r.motivo_perdida,
        cliente_nombre: c?.razon_social || c?.nombre_completo || "Cliente",
      };
    });
    setItems(mapped);
    setLoading(false);
  };

  const loadClientes = async () => {
    const { data } = await supabase.from("clientes")
      .select("id, razon_social, nombre_completo").order("razon_social", { nullsFirst: false });
    setClientes((data ?? []).map((c) => ({
      id: c.id,
      label: c.razon_social || c.nombre_completo || "(sin nombre)",
    })));
  };

  useEffect(() => { void load(); void loadClientes(); }, []);

  const grouped = useMemo(() => {
    const g: Record<EstadoOp, Oport[]> = { en_proceso: [], ganada: [], perdida: [] };
    items.forEach((o) => g[o.estado].push(o));
    return g;
  }, [items]);

  const create = async () => {
    if (!form.cliente_id) return toast.error("Selecciona el cliente");
    if (!form.titulo.trim()) return toast.error("Ponle un título a la oportunidad");
    setSaving(true);
    const { error } = await supabase.from("oportunidades").insert({
      cliente_id: form.cliente_id,
      titulo: form.titulo.trim(),
      servicio: form.servicio || null,
      monto_potencial: form.monto ? Number(form.monto) : null,
      probabilidad: form.probabilidad,
      fecha_cierre_estimada: form.fecha_cierre || null,
      ejecutivo_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo crear: " + error.message);
    toast.success("Oportunidad creada");
    setOpenNew(false);
    setForm({ cliente_id: "", titulo: "", servicio: "", monto: "", probabilidad: 50, fecha_cierre: "" });
    void load();
  };

  const moverA = async (op: Oport, nuevo: EstadoOp, motivo?: string) => {
    if (op.estado === nuevo) return;
    const patch: Partial<Oport> & { motivo_perdida?: string | null } = { estado: nuevo };
    if (nuevo === "perdida") patch.motivo_perdida = motivo ?? "";
    if (nuevo !== "perdida") patch.motivo_perdida = null;
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
          <p className="text-sm text-muted-foreground">Arrastra las tarjetas entre columnas para mover cada oportunidad.</p>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4" /> Nueva oportunidad</Button>
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
                      className="rounded-md border bg-background p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <Link to="/clientes/$id" params={{ id: o.cliente_id }} className="text-xs text-primary hover:underline truncate block">
                            {o.cliente_nombre}
                          </Link>
                          <p className="font-medium text-sm truncate">{o.titulo}</p>
                          {o.servicio && <p className="text-xs text-muted-foreground truncate">{o.servicio}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-semibold">{fmtMoney(o.monto_potencial)}</span>
                            <Badge variant="outline" className="text-[10px]">{o.probabilidad}%</Badge>
                          </div>
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

      {/* Dialog: nueva oportunidad */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva oportunidad</DialogTitle>
            <DialogDescription>Registra una posible venta para dar seguimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={(v) => setForm((s) => ({ ...s, cliente_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Elige un cliente" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Monto (S/)</Label>
                <Input type="number" step="0.01" value={form.monto}
                  onChange={(e) => setForm((s) => ({ ...s, monto: e.target.value }))} />
              </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Crear
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