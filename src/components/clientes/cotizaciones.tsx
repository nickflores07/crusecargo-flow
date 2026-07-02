import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileText, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type CotEstado = "borrador" | "enviada" | "pendiente" | "aceptada" | "rechazada" | "vencida";
type CotRow = {
  id: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: CotEstado;
  subtotal: number;
  igv: number;
  total: number;
  notas: string | null;
};
type Item = { descripcion: string; cantidad: string; precio_unit: string };

const IGV_RATE = 0.18;

const ESTADO_LABEL: Record<CotEstado, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};
const ESTADO_COLOR: Record<CotEstado, string> = {
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

export function Cotizaciones({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<CotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVenc, setFechaVenc] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<Item[]>([{ descripcion: "", cantidad: "1", precio_unit: "0" }]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("id, numero, fecha_emision, fecha_vencimiento, estado, subtotal, igv, total, notas")
      .eq("cliente_id", clienteId)
      .order("fecha_emision", { ascending: false });
    if (error) toast.error("No pudimos cargar las cotizaciones");
    setRows((data ?? []) as CotRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clienteId]);

  const resetForm = () => {
    setNumero(generarNumero());
    setFechaEmision(new Date().toISOString().slice(0, 10));
    setFechaVenc("");
    setNotas("");
    setItems([{ descripcion: "", cantidad: "1", precio_unit: "0" }]);
  };

  const openNueva = () => { resetForm(); setOpen(true); };

  const totales = useMemo(() => {
    const subtotal = items.reduce((s, it) => {
      const c = Number(it.cantidad || 0);
      const p = Number(it.precio_unit || 0);
      return s + c * p;
    }, 0);
    const igv = subtotal * IGV_RATE;
    return { subtotal, igv, total: subtotal + igv };
  }, [items]);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { descripcion: "", cantidad: "1", precio_unit: "0" }]);
  const removeItem = (i: number) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const save = async () => {
    if (!numero.trim()) return toast.error("Ingresa el número de cotización");
    if (items.every((it) => !it.descripcion.trim())) return toast.error("Agrega al menos un ítem");
    setSaving(true);
    const { data: cot, error } = await supabase
      .from("cotizaciones")
      .insert({
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
      })
      .select("id")
      .single();
    if (error || !cot) {
      setSaving(false);
      return toast.error("No se pudo crear: " + (error?.message ?? ""));
    }
    const payload = items
      .filter((it) => it.descripcion.trim())
      .map((it, idx) => {
        const cantidad = Number(it.cantidad || 0);
        const precio = Number(it.precio_unit || 0);
        return {
          cotizacion_id: cot.id,
          descripcion: it.descripcion,
          cantidad,
          precio_unit: precio,
          importe: cantidad * precio,
          orden: idx,
        };
      });
    const { error: e2 } = await supabase.from("cotizacion_items").insert(payload);
    setSaving(false);
    if (e2) return toast.error("Cotización creada pero fallaron los ítems: " + e2.message);
    toast.success("Cotización creada");
    setOpen(false);
    void load();
  };

  const updateEstado = async (id: string, estado: CotEstado) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado } : x)));
    const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(error.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Cotizaciones</CardTitle>
            <CardDescription>Prepara propuestas comerciales para este cliente.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNueva}><Plus className="h-4 w-4" /> Nueva cotización</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nueva cotización</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Número</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Aún no hay cotizaciones</p>
            <p className="text-xs text-muted-foreground">Crea la primera cotización para este cliente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    Emitida {c.fecha_emision}
                    {c.fecha_vencimiento ? ` · vence ${c.fecha_vencimiento}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">S/ {Number(c.total).toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">IGV incl.</p>
                </div>
                <Select value={c.estado} onValueChange={(v) => void updateEstado(c.id, v as CotEstado)}>
                  <SelectTrigger className={`h-8 w-[130px] text-xs ${ESTADO_COLOR[c.estado]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ESTADO_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => void remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}