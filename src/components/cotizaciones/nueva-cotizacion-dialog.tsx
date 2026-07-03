import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Wand2, X } from "lucide-react";
import { ClienteComboboxLoader, useClientes, type ClienteMini } from "@/components/clientes/cliente-combobox";

const IGV_RATE = 0.18;
const SERVICIOS = ["encomienda", "carga", "paqueteria", "documentos", "otro"];

type Item = {
  origen: string;
  destino: string;
  servicio: string;
  peso_kg: string;
  bultos: string;
  cantidad: string;
  precio_unit: string;
  precio_sugerido: number | null;
  tarifa_id: string | null;
  origen_tarifa: string | null;
  descripcion: string;
};

type Oportunidad = { id: string; titulo: string; estado: string };

const emptyItem = (): Item => ({
  origen: "",
  destino: "",
  servicio: "encomienda",
  peso_kg: "",
  bultos: "1",
  cantidad: "1",
  precio_unit: "0",
  precio_sugerido: null,
  tarifa_id: null,
  origen_tarifa: null,
  descripcion: "",
});

function buildDescripcion(it: Item): string {
  const parts: string[] = [];
  if (it.origen && it.destino) parts.push(`${it.origen} → ${it.destino}`);
  if (it.servicio) parts.push(it.servicio);
  if (it.peso_kg) parts.push(`${it.peso_kg} kg`);
  if (it.bultos && Number(it.bultos) > 1) parts.push(`${it.bultos} bultos`);
  return parts.join(" · ") || it.descripcion || "Servicio de envío";
}

export function NuevaCotizacionDialog({
  open,
  onOpenChange,
  clienteIdPreset,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clienteIdPreset?: string;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const { clientes } = useClientes();
  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const [clienteId, setClienteId] = useState(clienteIdPreset ?? "");
  const [correoDestino, setCorreoDestino] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [correosCc, setCorreosCc] = useState<string[]>([]);
  const [oportunidadId, setOportunidadId] = useState<string>("");
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().slice(0, 10));
  const [diasValidez, setDiasValidez] = useState("15");
  const [incluyeIgv, setIncluyeIgv] = useState(false);
  const [condiciones, setCondiciones] = useState(
    "• Precios expresados en Soles (S/).\n• Validez de la cotización según fecha indicada.\n• Sujeto a disponibilidad de espacio.\n• Los tiempos de tránsito son referenciales.",
  );
  const [notasInternas, setNotasInternas] = useState("");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  // Preset cliente
  useEffect(() => {
    if (open && clienteIdPreset) setClienteId(clienteIdPreset);
  }, [open, clienteIdPreset]);

  // Auto correo destino
  useEffect(() => {
    const c = clientesMap.get(clienteId) as ClienteMini | undefined;
    if (c?.correo) setCorreoDestino(c.correo);
  }, [clienteId, clientesMap]);

  // Cargar oportunidades del cliente
  useEffect(() => {
    if (!clienteId) { setOportunidades([]); setOportunidadId(""); return; }
    (async () => {
      const { data } = await supabase.from("oportunidades")
        .select("id, titulo, estado")
        .eq("cliente_id", clienteId)
        .in("estado", ["en_proceso"])
        .order("created_at", { ascending: false });
      setOportunidades((data ?? []) as Oportunidad[]);
    })();
  }, [clienteId]);

  const fechaVenc = useMemo(() => {
    const d = new Date(fechaEmision);
    d.setDate(d.getDate() + Number(diasValidez || 0));
    return d.toISOString().slice(0, 10);
  }, [fechaEmision, diasValidez]);

  const totales = useMemo(() => {
    const bruto = items.reduce((s, it) => s + Number(it.cantidad || 0) * Number(it.precio_unit || 0), 0);
    const subtotal = incluyeIgv ? bruto / (1 + IGV_RATE) : bruto;
    const igv = subtotal * IGV_RATE;
    return { subtotal, igv, total: subtotal + igv };
  }, [items, incluyeIgv]);

  const setItem = (i: number, patch: Partial<Item>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, emptyItem()]);
  const removeItem = (i: number) => setItems((arr) => (arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const sugerirTarifa = async (i: number) => {
    const it = items[i];
    if (!clienteId) return toast.error("Selecciona un cliente primero");
    if (!it.origen || !it.destino) return toast.error("Ingresa origen y destino");
    const { data, error } = await supabase.rpc("sugerir_tarifa", {
      _cliente_id: clienteId,
      _origen: it.origen,
      _destino: it.destino,
      _servicio: it.servicio,
      _peso_kg: Number(it.peso_kg || 0),
    });
    if (error) return toast.error(error.message);
    const r = (data as any[])?.[0];
    if (!r || r.origen_tarifa === "sin_tarifa") {
      setItem(i, { origen_tarifa: "sin_tarifa", precio_sugerido: null, tarifa_id: null });
      return toast.warning("No hay tarifa registrada para esa ruta. Ingresa el precio manualmente o carga la tarifa en el módulo Tarifario.");
    }
    setItem(i, {
      precio_unit: String(Number(r.precio_sugerido).toFixed(2)),
      precio_sugerido: Number(r.precio_sugerido),
      tarifa_id: r.tarifa_id,
      origen_tarifa: r.origen_tarifa,
    });
    toast.success(`Tarifa ${r.origen_tarifa === "cliente" ? "específica del cliente" : "general"} aplicada`);
  };

  const addCc = () => {
    const v = ccInput.trim();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast.error("Correo inválido");
    setCorreosCc((arr) => Array.from(new Set([...arr, v])));
    setCcInput("");
  };

  const save = async () => {
    if (!clienteId) return toast.error("Selecciona el cliente");
    const validItems = items.filter((it) => Number(it.cantidad) > 0 && Number(it.precio_unit) > 0 && (it.origen || it.descripcion));
    if (validItems.length === 0) return toast.error("Agrega al menos un ítem con precio");
    if (correoDestino && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoDestino)) return toast.error("Correo destino inválido");

    setSaving(true);
    const { data: cot, error } = await supabase.from("cotizaciones").insert({
      cliente_id: clienteId,
      ejecutivo_id: user?.id ?? null,
      created_by: user?.id ?? null,
      numero: "AUTO",
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVenc,
      estado: "borrador",
      moneda: "PEN",
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
      notas: notasInternas || null,
      oportunidad_id: oportunidadId || null,
      correo_destino: correoDestino || null,
      correos_cc: correosCc,
      condiciones: condiciones || null,
      notas_internas: notasInternas || null,
      incluye_igv: incluyeIgv,
    }).select("id").single();
    if (error || !cot) { setSaving(false); return toast.error("No se pudo crear: " + (error?.message ?? "")); }

    const payload = validItems.map((it, idx) => {
      const cantidad = Number(it.cantidad || 0);
      const precio = Number(it.precio_unit || 0);
      return {
        cotizacion_id: cot.id,
        descripcion: buildDescripcion(it),
        origen: it.origen || null,
        destino: it.destino || null,
        servicio: it.servicio || null,
        peso_kg: it.peso_kg ? Number(it.peso_kg) : null,
        bultos: it.bultos ? Number(it.bultos) : null,
        cantidad,
        precio_unit: precio,
        precio_sugerido: it.precio_sugerido,
        tarifa_id: it.tarifa_id,
        importe: cantidad * precio,
        orden: idx,
      };
    });
    const { error: e2 } = await supabase.from("cotizacion_items").insert(payload);
    setSaving(false);
    if (e2) return toast.error("Cotización creada pero fallaron los ítems: " + e2.message);
    toast.success("Cotización creada");
    // reset
    setItems([emptyItem()]);
    onCreated(cot.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva cotización</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Cliente y correo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Cliente *</Label>
              <ClienteComboboxLoader value={clienteId} onChange={(id) => setClienteId(id)} />
            </div>
            <div>
              <Label>Correo destino</Label>
              <Input
                type="email"
                value={correoDestino}
                onChange={(e) => setCorreoDestino(e.target.value)}
                placeholder={clientesMap.get(clienteId)?.correo || "cliente@correo.com"}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Puedes editarlo o dejarlo vacío por ahora.</p>
            </div>
          </div>

          {/* CC + oportunidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Copias (CC)</Label>
              <div className="flex gap-2">
                <Input value={ccInput} onChange={(e) => setCcInput(e.target.value)} placeholder="correo@empresa.com"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCc(); } }} />
                <Button type="button" variant="outline" onClick={addCc}>Agregar</Button>
              </div>
              {correosCc.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {correosCc.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                      {c}
                      <button onClick={() => setCorreosCc((arr) => arr.filter((x) => x !== c))} className="hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Oportunidad vinculada (opcional)</Label>
              <Select value={oportunidadId || "ninguna"} onValueChange={(v) => setOportunidadId(v === "ninguna" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin oportunidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin oportunidad</SelectItem>
                  {oportunidades.map((o) => <SelectItem key={o.id} value={o.id}>{o.titulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Emisión</Label><Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} /></div>
            <div><Label>Validez (días)</Label><Input type="number" min="1" value={diasValidez} onChange={(e) => setDiasValidez(e.target.value)} /></div>
            <div><Label>Vence</Label><Input type="date" value={fechaVenc} readOnly disabled /></div>
          </div>

          {/* Ítems */}
          <div className="rounded-lg border">
            <div className="p-2 text-[11px] uppercase text-muted-foreground bg-muted/30 border-b flex items-center justify-between">
              <span>Ítems (rutas)</span>
              <label className="flex items-center gap-1 normal-case text-xs">
                <input type="checkbox" checked={incluyeIgv} onChange={(e) => setIncluyeIgv(e.target.checked)} />
                Precios incluyen IGV
              </label>
            </div>
            {items.map((it, i) => {
              const importe = Number(it.cantidad || 0) * Number(it.precio_unit || 0);
              return (
                <div key={i} className="p-3 border-b last:border-b-0 space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <Input placeholder="Origen" value={it.origen} onChange={(e) => setItem(i, { origen: e.target.value, tarifa_id: null, origen_tarifa: null })} className="h-8" />
                    <Input placeholder="Destino" value={it.destino} onChange={(e) => setItem(i, { destino: e.target.value, tarifa_id: null, origen_tarifa: null })} className="h-8" />
                    <Select value={it.servicio} onValueChange={(v) => setItem(i, { servicio: v, tarifa_id: null, origen_tarifa: null })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SERVICIOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" step="0.01" placeholder="Peso (kg)" value={it.peso_kg} onChange={(e) => setItem(i, { peso_kg: e.target.value })} className="h-8" />
                    <Input type="number" placeholder="Bultos" value={it.bultos} onChange={(e) => setItem(i, { bultos: e.target.value })} className="h-8" />
                    <Button type="button" variant="outline" size="sm" onClick={() => void sugerirTarifa(i)} className="h-8" title="Sugerir tarifa desde el tarifario">
                      <Wand2 className="h-3.5 w-3.5" /> Sugerir
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_80px_110px_110px_40px] gap-2 items-center">
                    <Input placeholder="Descripción (opcional, se auto-genera)" value={it.descripcion} onChange={(e) => setItem(i, { descripcion: e.target.value })} className="h-8" />
                    <Input type="number" step="0.01" placeholder="Cant." value={it.cantidad} onChange={(e) => setItem(i, { cantidad: e.target.value })} className="h-8 text-right" />
                    <Input type="number" step="0.01" placeholder="P. Unit" value={it.precio_unit} onChange={(e) => setItem(i, { precio_unit: e.target.value })} className="h-8 text-right" />
                    <div className="text-right text-sm px-2 font-medium">S/ {importe.toFixed(2)}</div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={items.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {it.origen_tarifa && (
                    <p className={`text-[11px] ${it.origen_tarifa === "sin_tarifa" ? "text-amber-600" : "text-green-700 dark:text-green-400"}`}>
                      {it.origen_tarifa === "cliente" && "✓ Precio sugerido con tarifa específica del cliente"}
                      {it.origen_tarifa === "general" && "✓ Precio sugerido con tarifa general"}
                      {it.origen_tarifa === "sin_tarifa" && "⚠ Sin tarifa registrada — precio manual"}
                    </p>
                  )}
                </div>
              );
            })}
            <div className="p-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={addItem}><Plus className="h-4 w-4" /> Agregar ítem</Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            <div className="space-y-3">
              <div>
                <Label>Condiciones comerciales</Label>
                <Textarea rows={4} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
              </div>
              <div>
                <Label>Notas internas (no aparecen en la cotización)</Label>
                <Textarea rows={2} value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} />
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2 text-sm bg-muted/20">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">S/ {totales.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IGV (18%)</span><span className="font-mono">S/ {totales.igv.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2 text-lg"><span>Total</span><span className="font-mono">S/ {totales.total.toFixed(2)}</span></div>
              <p className="text-[11px] text-muted-foreground pt-1">
                {incluyeIgv ? "Los precios ingresados ya incluyen IGV." : "El IGV se calcula sobre los precios ingresados."}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}