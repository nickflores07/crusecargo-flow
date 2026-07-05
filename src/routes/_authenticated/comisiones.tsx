import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, Plus, Trash2, RefreshCw, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones")({
  component: ComisionesPage,
});

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }).format(Number(n || 0));

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type Regla = {
  id: string;
  ejecutivo_id: string | null;
  tipo: "venta_erp" | "oportunidad_ganada";
  porcentaje: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  activo: boolean;
  notas: string | null;
};

type Fila = {
  ejecutivo_id: string;
  ejecutivo_nombre: string;
  ventas_erp: number;
  pct_erp: number;
  comision_erp: number;
  monto_ganado_crm: number;
  pct_crm: number;
  comision_crm: number;
  total_comision: number;
};

function ComisionesPage() {
  const { isAdmin, isSupervisor } = useAuth();
  const puedeGestionar = isAdmin || isSupervisor;

  const [mes, setMes] = useState<string>(mesActual());
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; nombre: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // form
  const [fEjec, setFEjec] = useState<string>("general");
  const [fTipo, setFTipo] = useState<"venta_erp" | "oportunidad_ganada">("venta_erp");
  const [fPct, setFPct] = useState<string>("2");
  const [fDesde, setFDesde] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fHasta, setFHasta] = useState<string>("");
  const [fNotas, setFNotas] = useState<string>("");

  async function cargar() {
    setLoading(true);
    const [rComision, rReglas, rProfiles] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc("calcular_comisiones", { _mes: mes }),
      supabase.from("reglas_comision").select("*").order("vigente_desde", { ascending: false }),
      supabase.from("profiles").select("id, nombre").order("nombre"),
    ]);
    if (rComision.error) toast.error(rComision.error.message);
    setFilas((rComision.data as Fila[]) ?? []);
    setReglas((rReglas.data as Regla[]) ?? []);
    setProfiles(rProfiles.data ?? []);
    setLoading(false);
  }

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mes]);

  const totales = useMemo(() => {
    return filas.reduce(
      (a, f) => ({
        ventas: a.ventas + Number(f.ventas_erp || 0),
        ganado: a.ganado + Number(f.monto_ganado_crm || 0),
        comision: a.comision + Number(f.total_comision || 0),
      }),
      { ventas: 0, ganado: 0, comision: 0 }
    );
  }, [filas]);

  const nombreEjec = (id: string | null) => profiles.find((p) => p.id === id)?.nombre ?? "General (todos)";

  async function crearRegla() {
    if (!fPct || Number(fPct) < 0) return toast.error("Porcentaje inválido");
    const { error } = await supabase.from("reglas_comision").insert({
      ejecutivo_id: fEjec === "general" ? null : fEjec,
      tipo: fTipo,
      porcentaje: Number(fPct),
      vigente_desde: fDesde,
      vigente_hasta: fHasta || null,
      notas: fNotas || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Regla creada");
    setDialogOpen(false);
    setFPct("2"); setFNotas(""); setFHasta("");
    cargar();
  }

  async function eliminarRegla(id: string) {
    if (!confirm("¿Eliminar esta regla?")) return;
    const { error } = await supabase.from("reglas_comision").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Regla eliminada");
    cargar();
  }

  async function toggleActivo(r: Regla) {
    const { error } = await supabase.from("reglas_comision").update({ activo: !r.activo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    cargar();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6" /> Comisiones
          </h1>
          <p className="text-muted-foreground mt-1">
            Cruce automático entre ventas del ERP y oportunidades ganadas del CRM.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Mes</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-[160px]" />
          </div>
          <Button variant="outline" onClick={cargar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Ventas ERP del mes</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{PEN(totales.ventas)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Oportunidades ganadas</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{PEN(totales.ganado)}</p>
        </CardContent></Card>
        <Card className="border-primary/40 bg-primary/5"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total a pagar en comisiones</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-primary">{PEN(totales.comision)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comisiones del período</CardTitle>
          <CardDescription>Se aplica la regla específica por ejecutivo; si no existe, se usa la regla general.</CardDescription>
        </CardHeader>
        <CardContent>
          {filas.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-6">
              <Info className="h-4 w-4" /> No hay datos para {mes}. Procesa cargas del ERP y/o cierra oportunidades como ganadas.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ejecutivo</TableHead>
                  <TableHead className="text-right">Ventas ERP</TableHead>
                  <TableHead className="text-right">% ERP</TableHead>
                  <TableHead className="text-right">Comisión ERP</TableHead>
                  <TableHead className="text-right">Ganado CRM</TableHead>
                  <TableHead className="text-right">% CRM</TableHead>
                  <TableHead className="text-right">Comisión CRM</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.ejecutivo_id}>
                    <TableCell className="font-medium">{f.ejecutivo_nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{PEN(f.ventas_erp)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(f.pct_erp).toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{PEN(f.comision_erp)}</TableCell>
                    <TableCell className="text-right tabular-nums">{PEN(f.monto_ganado_crm)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(f.pct_crm).toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{PEN(f.comision_crm)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-primary">{PEN(f.total_comision)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Reglas de comisión</CardTitle>
            <CardDescription>Configura porcentajes por ejecutivo o generales, con vigencia.</CardDescription>
          </div>
          {puedeGestionar && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Nueva regla</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nueva regla de comisión</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div>
                    <Label>Ejecutivo</Label>
                    <Select value={fEjec} onValueChange={setFEjec}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General (aplica a todos)</SelectItem>
                        {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={fTipo} onValueChange={(v) => setFTipo(v as "venta_erp" | "oportunidad_ganada")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venta_erp">Venta ERP (facturación real)</SelectItem>
                        <SelectItem value="oportunidad_ganada">Oportunidad ganada (CRM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Porcentaje %</Label>
                      <Input type="number" step="0.1" value={fPct} onChange={(e) => setFPct(e.target.value)} />
                    </div>
                    <div>
                      <Label>Desde</Label>
                      <Input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
                    </div>
                    <div>
                      <Label>Hasta</Label>
                      <Input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Notas</Label>
                    <Input value={fNotas} onChange={(e) => setFNotas(e.target.value)} placeholder="Ej: bono especial Q1" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={crearRegla}>Crear regla</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {reglas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aún no hay reglas configuradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  {puedeGestionar && <TableHead className="w-[100px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reglas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nombreEjec(r.ejecutivo_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.tipo === "venta_erp" ? "Venta ERP" : "Oport. ganada"}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.porcentaje).toFixed(2)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.vigente_desde} → {r.vigente_hasta ?? "∞"}
                    </TableCell>
                    <TableCell>
                      {r.activo ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.notas ?? "—"}</TableCell>
                    {puedeGestionar && (
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => toggleActivo(r)}>
                            {r.activo ? "Pausar" : "Activar"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => eliminarRegla(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}