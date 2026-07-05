import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Printer, CheckCircle2, XCircle, Send, Trash2, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/cotizaciones/$id")({
  component: CotizacionDetalle,
});

type Estado = "borrador" | "enviada" | "pendiente" | "aceptada" | "rechazada" | "vencida";
type Cot = {
  id: string; numero: string; cliente_id: string; ejecutivo_id: string | null;
  fecha_emision: string; fecha_vencimiento: string | null; estado: Estado;
  subtotal: number; igv: number; total: number; moneda: string;
  incluye_igv: boolean; correo_destino: string | null; correos_cc: string[];
  condiciones: string | null; notas: string | null; notas_internas: string | null;
  oportunidad_id: string | null; motivo_rechazo: string | null; token_publico: string | null;
};
type Item = {
  id: string; descripcion: string; origen: string | null; destino: string | null;
  servicio: string | null; peso_kg: number | null; bultos: number | null;
  cantidad: number; precio_unit: number; importe: number; orden: number;
};
type Cliente = { razon_social: string | null; nombre_completo: string | null; ruc: string | null; dni: string | null; direccion: string | null; ciudad: string | null; correo: string | null; telefono: string | null; tipo: string };

const ESTADO_LABEL: Record<Estado, string> = {
  borrador: "Borrador", enviada: "Enviada", pendiente: "Pendiente",
  aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};
const ESTADO_COLOR: Record<Estado, string> = {
  borrador: "bg-gray-100 text-gray-700", enviada: "bg-blue-100 text-blue-700",
  pendiente: "bg-amber-100 text-amber-700", aceptada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700", vencida: "bg-orange-100 text-orange-700",
};

function CotizacionDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cot, setCot] = useState<Cot | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ejecutivo, setEjecutivo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [motivo, setMotivo] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("cotizaciones").select("*").eq("id", id).maybeSingle();
    if (!c) { toast.error("Cotización no encontrada"); setLoading(false); return; }
    setCot(c as unknown as Cot);
    const [{ data: its }, { data: cli }, { data: prof }] = await Promise.all([
      supabase.from("cotizacion_items").select("*").eq("cotizacion_id", id).order("orden"),
      supabase.from("clientes").select("razon_social, nombre_completo, ruc, dni, direccion, ciudad, correo, telefono, tipo").eq("id", (c as any).cliente_id).maybeSingle(),
      (c as any).ejecutivo_id ? supabase.from("profiles").select("nombre").eq("id", (c as any).ejecutivo_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setItems((its ?? []) as Item[]);
    setCliente((cli as Cliente) ?? null);
    setEjecutivo((prof as any)?.nombre ?? null);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [id]);

  const cambiarEstado = async (nuevo: Estado, extra: Record<string, unknown> = {}) => {
    if (!cot) return;
    const { error } = await supabase.from("cotizaciones").update({ estado: nuevo, ...extra }).eq("id", cot.id);
    if (error) return toast.error(error.message);
    setCot({ ...cot, estado: nuevo, ...extra } as Cot);
    toast.success("Estado actualizado");
  };

  const marcarAceptada = async () => {
    if (!cot) return;
    if (!confirm("¿Marcar como aceptada? Se crearán envíos estimados por cada ítem para dar seguimiento comercial.")) return;
    await cambiarEstado("aceptada");
    // Crear envíos estimados
    const payload = items.filter((it) => it.origen && it.destino).map((it) => ({
      cliente_id: cot.cliente_id,
      ejecutivo_id: cot.ejecutivo_id ?? user?.id ?? null,
      created_by: user?.id ?? null,
      fecha: new Date().toISOString().slice(0, 10),
      origen: it.origen,
      destino: it.destino,
      servicio: it.servicio,
      peso_kg: it.peso_kg,
      bultos: it.bultos,
      importe: it.importe,
      estado: "estimado" as const,
      cotizacion_id: cot.id,
      origen_registro: "cotizacion_aceptada",
      notas: `Generado desde cotización ${cot.numero}`,
    }));
    if (payload.length > 0) {
      const { error } = await supabase.from("envios").insert(payload);
      if (error) toast.error("Cotización aceptada pero no se crearon envíos: " + error.message);
      else toast.success(`Se crearon ${payload.length} envío(s) estimado(s) para seguimiento.`);
    }
    // Registrar seguimiento si hay oportunidad
    if (cot.oportunidad_id) {
      const { error: segErr } = await supabase.from("seguimientos").insert({
        cliente_id: cot.cliente_id,
        tipo: "otro",
        usuario_id: user?.id ?? null,
        resultado: `Cotización ${cot.numero} aceptada. Total: S/ ${Number(cot.total).toFixed(2)}. Se generaron envíos estimados.`,
      });
      if (segErr) toast.error("No se pudo registrar el seguimiento: " + segErr.message);
    }
  };

  const marcarRechazada = async () => {
    if (!cot || !motivo.trim()) return toast.error("Ingresa el motivo");
    await cambiarEstado("rechazada", { motivo_rechazo: motivo.trim() });
    setRechazoOpen(false);
    setMotivo("");
  };

  const marcarEnviada = async () => {
    if (!cot) return;
    await cambiarEstado("enviada", { enviada_en: new Date().toISOString(), enviada_a: cot.correo_destino });
  };

  const enviarPorCorreo = () => {
    toast.info("Envío por correo (próximamente). Por ahora usa 'Marcar como enviada' tras enviar manualmente.");
  };

  const copiarEnlace = async () => {
    if (!cot?.token_publico) return toast.error("Esta cotización no tiene enlace público.");
    const url = `${window.location.origin}/c/${cot.token_publico}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado. Compártelo con tu cliente.");
    } catch {
      toast.info(url);
    }
  };

  const eliminar = async () => {
    if (!cot || !confirm("¿Eliminar esta cotización?")) return;
    const { error } = await supabase.from("cotizaciones").delete().eq("id", cot.id);
    if (error) return toast.error(error.message);
    toast.success("Cotización eliminada");
    navigate({ to: "/cotizaciones" });
  };

  if (loading) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!cot) return <div className="p-6">Cotización no encontrada</div>;

  const clienteNombre = cliente?.tipo === "empresa" ? cliente?.razon_social : cliente?.nombre_completo;
  const clienteDoc = cliente?.tipo === "empresa" ? cliente?.ruc : cliente?.dni;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Barra de acciones - no imprime */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/cotizaciones">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Volver</Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Select value={cot.estado} onValueChange={(v) => void cambiarEstado(v as Estado)}>
            <SelectTrigger className={`h-9 w-[140px] text-xs ${ESTADO_COLOR[cot.estado]}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ESTADO_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimir / PDF</Button>
          <Button variant="outline" size="sm" onClick={() => void copiarEnlace()}>
            <LinkIcon className="h-4 w-4" /> Copiar enlace público
          </Button>
          <Button variant="outline" size="sm" onClick={enviarPorCorreo} title="Próximamente"><Send className="h-4 w-4" /> Enviar por correo (próximamente)</Button>
          {cot.estado === "borrador" && (
            <Button size="sm" onClick={() => void marcarEnviada()}>Marcar enviada</Button>
          )}
          {["enviada", "pendiente", "borrador"].includes(cot.estado) && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => void marcarAceptada()}>
                <CheckCircle2 className="h-4 w-4" /> Aceptar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRechazoOpen(true)}>
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => void eliminar()}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Documento imprimible */}
      <div className="bg-white text-gray-900 rounded-lg border shadow-sm p-8 md:p-12 print:shadow-none print:border-none">
        <div className="flex items-start justify-between gap-6 border-b pb-6">
          <div>
            <div className="text-red-600 font-bold text-xl">Cruz del Sur Cargo</div>
            <p className="text-xs text-gray-500 mt-1">CRM Comercial</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500">Cotización</p>
            <p className="text-2xl font-bold">{cot.numero}</p>
            <p className="text-xs text-gray-500 mt-1">Emisión: {cot.fecha_emision}</p>
            {cot.fecha_vencimiento && <p className="text-xs text-gray-500">Válida hasta: {cot.fecha_vencimiento}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 border-b text-sm">
          <div>
            <p className="text-[11px] uppercase text-gray-500 mb-1">Cliente</p>
            <p className="font-semibold">{clienteNombre || "—"}</p>
            {clienteDoc && <p className="text-xs text-gray-600">{cliente?.tipo === "empresa" ? "RUC" : "DNI"}: {clienteDoc}</p>}
            {cliente?.direccion && <p className="text-xs text-gray-600">{cliente.direccion}{cliente.ciudad ? `, ${cliente.ciudad}` : ""}</p>}
            {cliente?.correo && <p className="text-xs text-gray-600">{cliente.correo}</p>}
            {cliente?.telefono && <p className="text-xs text-gray-600">{cliente.telefono}</p>}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase text-gray-500 mb-1">Ejecutivo comercial</p>
            <p className="font-semibold">{ejecutivo ?? "—"}</p>
            {cot.correo_destino && (
              <>
                <p className="text-[11px] uppercase text-gray-500 mt-3 mb-1">Enviar a</p>
                <p className="text-xs">{cot.correo_destino}</p>
                {cot.correos_cc?.length > 0 && <p className="text-xs text-gray-500">CC: {cot.correos_cc.join(", ")}</p>}
              </>
            )}
          </div>
        </div>

        <table className="w-full mt-6 text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase text-gray-500">
              <th className="py-2">Servicio</th>
              <th className="py-2 text-right">Peso</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">P. Unit</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b">
                <td className="py-2">
                  <p className="font-medium">
                    {it.origen && it.destino ? `${it.origen} → ${it.destino}` : it.descripcion}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {[it.servicio, it.bultos && `${it.bultos} bultos`].filter(Boolean).join(" · ")}
                    {it.descripcion && (it.origen || it.destino) ? ` · ${it.descripcion}` : ""}
                  </p>
                </td>
                <td className="py-2 text-right">{it.peso_kg ? `${it.peso_kg} kg` : "—"}</td>
                <td className="py-2 text-right">{Number(it.cantidad)}</td>
                <td className="py-2 text-right font-mono">{Number(it.precio_unit).toFixed(2)}</td>
                <td className="py-2 text-right font-mono font-medium">{Number(it.importe).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-6">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-mono">S/ {Number(cot.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>IGV (18%)</span><span className="font-mono">S/ {Number(cot.igv).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2 mt-1">
              <span>Total</span><span className="font-mono">S/ {Number(cot.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {cot.condiciones && (
          <div className="mt-8 pt-6 border-t">
            <p className="text-[11px] uppercase text-gray-500 mb-2">Condiciones comerciales</p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{cot.condiciones}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t text-center text-[11px] text-gray-500">
          Gracias por confiar en Cruz del Sur Cargo. Para consultas, contacta a tu ejecutivo asignado.
        </div>
      </div>

      {cot.notas_internas && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm print:hidden">
          <p className="text-[11px] uppercase text-amber-700 dark:text-amber-400 mb-1">Notas internas (solo equipo)</p>
          <p className="whitespace-pre-wrap">{cot.notas_internas}</p>
        </div>
      )}
      {cot.motivo_rechazo && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/10 p-3 text-sm print:hidden">
          <p className="text-[11px] uppercase text-red-700 dark:text-red-400 mb-1">Motivo de rechazo</p>
          <p>{cot.motivo_rechazo}</p>
        </div>
      )}

      <Dialog open={rechazoOpen} onOpenChange={setRechazoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo de rechazo</DialogTitle></DialogHeader>
          <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Precio, tiempo de entrega, competencia..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoOpen(false)}>Cancelar</Button>
            <Button onClick={() => void marcarRechazada()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}