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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Package, Trash2 } from "lucide-react";

type EnvioEstado = "en_transito" | "entregado" | "devuelto" | "anulado";
type EnvioRow = {
  id: string;
  fecha: string;
  guia: string | null;
  servicio: string | null;
  origen: string | null;
  destino: string | null;
  peso_kg: number | null;
  bultos: number | null;
  importe: number | null;
  estado: EnvioEstado;
  notas: string | null;
};

const ESTADO_LABEL: Record<EnvioEstado, string> = {
  en_transito: "En tránsito",
  entregado: "Entregado",
  devuelto: "Devuelto",
  anulado: "Anulado",
};
const ESTADO_COLOR: Record<EnvioEstado, string> = {
  en_transito: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  entregado: "bg-green-500/10 text-green-700 dark:text-green-300",
  devuelto: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  anulado: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const emptyNew = {
  fecha: new Date().toISOString().slice(0, 10),
  guia: "",
  servicio: "",
  origen: "",
  destino: "",
  peso_kg: "",
  bultos: "",
  importe: "",
  estado: "en_transito" as EnvioEstado,
  notas: "",
};

export function Envios({ clienteId }: { clienteId: string }) {
  const [rows, setRows] = useState<EnvioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuevo, setNuevo] = useState({ ...emptyNew });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("envios")
      .select("id, fecha, guia, servicio, origen, destino, peso_kg, bultos, importe, estado, notas")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false });
    if (error) toast.error("No pudimos cargar los envíos");
    setRows((data ?? []) as EnvioRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clienteId]);

  const totales = useMemo(() => {
    const count = rows.length;
    const peso = rows.reduce((s, r) => s + Number(r.peso_kg ?? 0), 0);
    const facturado = rows.reduce((s, r) => s + Number(r.importe ?? 0), 0);
    return { count, peso, facturado };
  }, [rows]);

  const num = (s: string) => (s === "" ? null : Number(s));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("envios").insert({
      cliente_id: clienteId,
      fecha: nuevo.fecha,
      guia: nuevo.guia || null,
      servicio: nuevo.servicio || null,
      origen: nuevo.origen || null,
      destino: nuevo.destino || null,
      peso_kg: num(nuevo.peso_kg),
      bultos: nuevo.bultos === "" ? null : Number(nuevo.bultos),
      importe: num(nuevo.importe),
      estado: nuevo.estado,
      notas: nuevo.notas || null,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo registrar: " + error.message);
    toast.success("Envío registrado");
    setOpen(false);
    setNuevo({ ...emptyNew });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este envío?")) return;
    const { error } = await supabase.from("envios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const updateEstado = async (id: string, estado: EnvioEstado) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado } : x)));
    const { error } = await supabase.from("envios").update({ estado }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error(error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Historial de envíos</CardTitle>
            <CardDescription>Registra cada envío para ver el volumen real del cliente.</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4" /> Registrar envío</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo envío</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fecha</Label><Input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} /></div>
                <div><Label>Guía</Label><Input value={nuevo.guia} onChange={(e) => setNuevo({ ...nuevo, guia: e.target.value })} placeholder="N° guía" /></div>
                <div className="col-span-2"><Label>Servicio</Label><Input value={nuevo.servicio} onChange={(e) => setNuevo({ ...nuevo, servicio: e.target.value })} placeholder="Encomienda, carga pesada..." /></div>
                <div><Label>Origen</Label><Input value={nuevo.origen} onChange={(e) => setNuevo({ ...nuevo, origen: e.target.value })} /></div>
                <div><Label>Destino</Label><Input value={nuevo.destino} onChange={(e) => setNuevo({ ...nuevo, destino: e.target.value })} /></div>
                <div><Label>Peso (kg)</Label><Input type="number" step="0.01" value={nuevo.peso_kg} onChange={(e) => setNuevo({ ...nuevo, peso_kg: e.target.value })} /></div>
                <div><Label>Bultos</Label><Input type="number" value={nuevo.bultos} onChange={(e) => setNuevo({ ...nuevo, bultos: e.target.value })} /></div>
                <div><Label>Importe (S/)</Label><Input type="number" step="0.01" value={nuevo.importe} onChange={(e) => setNuevo({ ...nuevo, importe: e.target.value })} /></div>
                <div>
                  <Label>Estado</Label>
                  <Select value={nuevo.estado} onValueChange={(v) => setNuevo({ ...nuevo, estado: v as EnvioEstado })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESTADO_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Notas</Label><Textarea rows={2} value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Envíos</p>
            <p className="text-2xl font-bold">{totales.count}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Peso total (kg)</p>
            <p className="text-2xl font-bold">{totales.peso.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Facturado (S/)</p>
            <p className="text-2xl font-bold">{totales.facturado.toFixed(2)}</p>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 border border-dashed rounded-lg">
            <Package className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Aún no hay envíos registrados</p>
            <p className="text-xs text-muted-foreground">Registra el primer envío para empezar a medir el volumen.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Guía</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead className="text-right">Peso</TableHead>
                  <TableHead className="text-right">Bultos</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.fecha}</TableCell>
                    <TableCell className="text-xs">{r.guia ?? "—"}</TableCell>
                    <TableCell>{r.servicio ?? "—"}</TableCell>
                    <TableCell className="text-xs">{[r.origen, r.destino].filter(Boolean).join(" → ") || "—"}</TableCell>
                    <TableCell className="text-right">{r.peso_kg ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.bultos ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.importe != null ? Number(r.importe).toFixed(2) : "—"}</TableCell>
                    <TableCell>
                      <Select value={r.estado} onValueChange={(v) => void updateEstado(r.id, v as EnvioEstado)}>
                        <SelectTrigger className={`h-7 w-[130px] text-xs ${ESTADO_COLOR[r.estado]}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTADO_LABEL).map(([k, l]) => (
                            <SelectItem key={k} value={k}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => void remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
