import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Loader2, FileText, Printer } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/c/$token")({
  head: () => ({
    meta: [
      { title: "Tu cotización — Cruz del Sur Cargo" },
      { name: "description", content: "Revisa y confirma tu cotización." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CotizacionPublica,
});

type Item = {
  id: string; descripcion: string | null; origen: string | null; destino: string | null;
  servicio: string | null; peso_kg: number | null; bultos: number | null;
  cantidad: number; precio_unit: number; importe: number;
};
type Data = {
  cotizacion: {
    numero: string; fecha_emision: string; fecha_vencimiento: string | null;
    estado: string; subtotal: number; igv: number; total: number; moneda: string;
    incluye_igv: boolean; condiciones: string | null; motivo_rechazo: string | null;
    enviada_en: string | null;
  };
  items: Item[];
  cliente: { nombre: string | null; documento: string | null; ciudad: string | null } | null;
  ejecutivo: string | null;
};

function CotizacionPublica() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [correo, setCorreo] = useState("");
  const [aceptarOpen, setAceptarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/cotizacion/${token}`);
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "No se pudo cargar la cotización.");
      } else {
        setData(await res.json());
      }
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token]);

  const enviarAccion = async (action: "aceptar" | "rechazar", payload: Record<string, string> = {}) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/public/cotizacion/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const b = await res.json();
      if (!res.ok) {
        toast.error(b.error ?? "No se pudo procesar.");
      } else {
        toast.success(action === "aceptar" ? "¡Cotización aceptada!" : "Cotización rechazada");
        setAceptarOpen(false);
        setRechazoOpen(false);
        void load();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 p-6 text-center">
        <div className="max-w-md">
          <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h1 className="text-xl font-semibold mb-2">Cotización no disponible</h1>
          <p className="text-sm text-muted-foreground">{error ?? "El enlace no es válido o ha expirado."}</p>
        </div>
      </div>
    );
  }

  const c = data.cotizacion;
  const vencida =
    c.fecha_vencimiento && new Date(c.fecha_vencimiento) < new Date(new Date().toDateString());
  const finalizada = ["aceptada", "rechazada"].includes(c.estado);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto space-y-4 px-3">
        {/* Barra acciones - no imprime */}
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="text-xs text-muted-foreground">
            Cruz del Sur Cargo · Cotización pública
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        {/* Documento */}
        <div className="bg-white rounded-lg shadow-sm border p-6 md:p-10 text-gray-900 print:shadow-none print:border-none">
          <div className="flex items-start justify-between gap-6 border-b pb-6">
            <div>
              <div className="text-red-600 font-bold text-xl">Cruz del Sur Cargo</div>
              <p className="text-xs text-gray-500 mt-1">Servicios de envío</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-500">Cotización</p>
              <p className="text-2xl font-bold">{c.numero}</p>
              <p className="text-xs text-gray-500 mt-1">Emisión: {c.fecha_emision}</p>
              {c.fecha_vencimiento && (
                <p className={`text-xs ${vencida ? "text-red-600 font-medium" : "text-gray-500"}`}>
                  Válida hasta: {c.fecha_vencimiento}
                </p>
              )}
            </div>
          </div>

          {data.cliente && (
            <div className="grid grid-cols-2 gap-6 py-6 border-b text-sm">
              <div>
                <p className="text-[11px] uppercase text-gray-500 mb-1">Cliente</p>
                <p className="font-semibold">{data.cliente.nombre || "—"}</p>
                {data.cliente.documento && (
                  <p className="text-xs text-gray-600">{data.cliente.documento}</p>
                )}
                {data.cliente.ciudad && (
                  <p className="text-xs text-gray-600">{data.cliente.ciudad}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase text-gray-500 mb-1">Ejecutivo</p>
                <p className="font-semibold">{data.ejecutivo ?? "—"}</p>
              </div>
            </div>
          )}

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
              {data.items.map((it) => (
                <tr key={it.id} className="border-b">
                  <td className="py-2">
                    <p className="font-medium">
                      {it.origen && it.destino ? `${it.origen} → ${it.destino}` : it.descripcion}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {[it.servicio, it.bultos && `${it.bultos} bultos`].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="py-2 text-right">{it.peso_kg ? `${it.peso_kg} kg` : "—"}</td>
                  <td className="py-2 text-right">{Number(it.cantidad)}</td>
                  <td className="py-2 text-right font-mono">{Number(it.precio_unit).toFixed(2)}</td>
                  <td className="py-2 text-right font-mono font-medium">
                    {Number(it.importe).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mt-6">
            <div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-mono">S/ {Number(c.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>IGV (18%)</span>
                <span className="font-mono">S/ {Number(c.igv).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2 mt-1">
                <span>Total</span>
                <span className="font-mono">S/ {Number(c.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {c.condiciones && (
            <div className="mt-8 pt-6 border-t">
              <p className="text-[11px] uppercase text-gray-500 mb-2">Condiciones comerciales</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{c.condiciones}</p>
            </div>
          )}

          <div className="mt-10 pt-6 border-t text-center text-[11px] text-gray-500">
            Gracias por confiar en Cruz del Sur Cargo.
          </div>
        </div>

        {/* Zona de decisión */}
        {finalizada ? (
          <div
            className={`rounded-lg border p-4 text-center print:hidden ${
              c.estado === "aceptada"
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}
          >
            {c.estado === "aceptada" ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-green-800">¡Cotización aceptada!</p>
                <p className="text-xs text-green-700 mt-1">
                  Tu ejecutivo se pondrá en contacto para coordinar los envíos.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="font-semibold text-red-800">Cotización rechazada</p>
                {c.motivo_rechazo && (
                  <p className="text-xs text-red-700 mt-1">Motivo: {c.motivo_rechazo}</p>
                )}
              </>
            )}
          </div>
        ) : vencida ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-center text-sm print:hidden">
            Esta cotización venció el {c.fecha_vencimiento}. Contacta a tu ejecutivo para renovarla.
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm text-muted-foreground">
              ¿Deseas confirmar esta cotización?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRechazoOpen(true)}
                disabled={saving}
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setAceptarOpen(true)}
                disabled={saving}
              >
                <CheckCircle2 className="h-4 w-4" /> Aceptar
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={aceptarOpen} onOpenChange={setAceptarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceptar cotización {c.numero}</DialogTitle>
            <DialogDescription>
              Al aceptar, tu ejecutivo recibirá una notificación para coordinar los envíos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Correo de contacto (opcional)</label>
            <Input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAceptarOpen(false)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => void enviarAccion("aceptar", correo ? { correo } : {})}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar aceptación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rechazoOpen} onOpenChange={setRechazoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar cotización {c.numero}</DialogTitle>
            <DialogDescription>Cuéntanos brevemente por qué la rechazas.</DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Precio, tiempo de entrega, elegimos otra opción..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazoOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => void enviarAccion("rechazar", { motivo: motivo.trim() })}
              disabled={saving || !motivo.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}