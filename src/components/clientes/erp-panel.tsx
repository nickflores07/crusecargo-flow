import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, TrendingUp } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type Resumen = {
  num_operaciones: number | null;
  total: number | null;
  ticket_promedio: number | null;
  ultima_venta: string | null;
};

type OperacionRow = {
  id: string;
  fecha: string | null;
  servicio: string | null;
  origen: string | null;
  destino: string | null;
  guia_numero: string | null;
  monto: number | null;
  moneda: string | null;
};

function fmt(n: number | null | undefined, moneda = "PEN") {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);
}

export function ErpPanel({ clienteId }: { clienteId: string }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ops, setOps] = useState<OperacionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: res }, { data: rows }] = await Promise.all([
        supabase.from("erp_ventas_cliente_12m").select("*").eq("cliente_id", clienteId).maybeSingle(),
        supabase
          .from("erp_ventas_staging")
          .select("id, fecha, servicio, origen, destino, guia_numero, monto, moneda")
          .eq("cliente_id", clienteId)
          .eq("procesado", true)
          .order("fecha", { ascending: false })
          .limit(15),
      ]);
      if (!alive) return;
      setResumen((res as Resumen) ?? null);
      setOps((rows as OperacionRow[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [clienteId]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Operaciones 12m" value={resumen?.num_operaciones ?? 0} icon={Database} />
        <SummaryCard label="Total facturado 12m" value={fmt(resumen?.total)} icon={TrendingUp} />
        <SummaryCard label="Ticket promedio" value={fmt(resumen?.ticket_promedio)} icon={TrendingUp} />
        <SummaryCard
          label="Última venta"
          value={resumen?.ultima_venta ? new Date(resumen.ultima_venta).toLocaleDateString() : "—"}
          icon={Database}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operaciones ERP recientes</CardTitle>
          <CardDescription>
            Datos crudos importados desde el ERP. Sólo se ven los registros que ya se procesaron y vincularon a este cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : ops.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Aún no hay operaciones del ERP para este cliente. Sube y procesa un archivo desde <b>Administración → ERP / Cargas</b>.
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
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ops.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{o.fecha ? new Date(o.fecha).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{o.guia_numero ?? "—"}</TableCell>
                      <TableCell>{o.servicio ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.origen || "—"} → {o.destino || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {fmt(o.monto, o.moneda ?? "PEN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label, value, icon: Icon,
}: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}