import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, ShieldAlert, TrendingUp, Users, Target, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type Profile = { id: string; nombre: string };
type VentasEjec = { ejecutivo_id: string | null; clientes_atendidos: number | null; num_operaciones: number | null; total: number | null };
type OportRow = { ejecutivo_id: string | null; estado: string | null; valor_estimado: number | null; probabilidad: number | null };
type VisitaRow = { ejecutivo_id: string; estado: string };
type ClienteRow = { ejecutivo_id: string | null };

function fmt(n: number | null | undefined) {
  if (!n) return "S/ 0";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n);
}

function ReportesPage() {
  const { isAdmin, isSupervisor, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const puede = isAdmin || isSupervisor;
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ventas, setVentas] = useState<VentasEjec[]>([]);
  const [oport, setOport] = useState<OportRow[]>([]);
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);

  useEffect(() => {
    if (!authLoading && !puede) navigate({ to: "/" });
  }, [authLoading, puede, navigate]);

  useEffect(() => {
    if (!puede) return;
    (async () => {
      setLoading(true);
      const hoy = new Date();
      const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
      const desde = hace30.toISOString().slice(0, 10);

      const [
        { data: profs },
        { data: v },
        { data: op },
        { data: vis },
        { data: cli },
      ] = await Promise.all([
        supabase.from("profiles").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("erp_ventas_ejecutivo_12m").select("*"),
        supabase.from("oportunidades").select("ejecutivo_id, estado, valor_estimado, probabilidad"),
        supabase.from("visitas_planificadas").select("ejecutivo_id, estado").gte("fecha_planificada", desde),
        supabase.from("clientes").select("ejecutivo_id"),
      ]);

      setProfiles((profs as Profile[]) ?? []);
      setVentas((v as VentasEjec[]) ?? []);
      setOport((op as OportRow[]) ?? []);
      setVisitas((vis as VisitaRow[]) ?? []);
      setClientes((cli as ClienteRow[]) ?? []);
      setLoading(false);
    })();
  }, [puede]);

  const rows = useMemo(() => {
    return profiles.map((p) => {
      const ventaRow = ventas.find((x) => x.ejecutivo_id === p.id);
      const oportEjec = oport.filter((o) => o.ejecutivo_id === p.id);
      const abiertas = oportEjec.filter((o) => o.estado && !["ganada", "perdida"].includes(o.estado));
      const pipelinePond = abiertas.reduce(
        (s, o) => s + (Number(o.valor_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100)),
        0,
      );
      const ganadas = oportEjec.filter((o) => o.estado === "ganada");
      const ganadasValor = ganadas.reduce((s, o) => s + Number(o.valor_estimado ?? 0), 0);
      const cerradas = oportEjec.filter((o) => o.estado === "ganada" || o.estado === "perdida");
      const conversion = cerradas.length ? (ganadas.length / cerradas.length) * 100 : 0;
      const visitasEjec = visitas.filter((x) => x.ejecutivo_id === p.id);
      const visitasReal = visitasEjec.filter((x) => x.estado === "realizada").length;
      const cartera = clientes.filter((c) => c.ejecutivo_id === p.id).length;

      return {
        id: p.id,
        nombre: p.nombre,
        cartera,
        ventas12m: Number(ventaRow?.total ?? 0),
        clientesFacturados: Number(ventaRow?.clientes_atendidos ?? 0),
        pipelinePond,
        oportAbiertas: abiertas.length,
        conversion,
        ganadas: ganadas.length,
        ganadasValor,
        visitas: visitasEjec.length,
        visitasReal,
      };
    });
  }, [profiles, ventas, oport, visitas, clientes]);

  const totales = useMemo(() => ({
    ventas12m: rows.reduce((s, r) => s + r.ventas12m, 0),
    pipeline: rows.reduce((s, r) => s + r.pipelinePond, 0),
    oport: rows.reduce((s, r) => s + r.oportAbiertas, 0),
    ganadasValor: rows.reduce((s, r) => s + r.ganadasValor, 0),
  }), [rows]);

  if (!puede) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" /> Sección solo para administradores y supervisores.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold font-display">Reportes por ejecutivo</h1>
          <p className="text-sm text-muted-foreground">
            Rendimiento comercial cruzando pipeline, actividad (visitas 30d) y ventas ERP (12 meses).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={DollarSign} label="Ventas 12m (ERP)" value={fmt(totales.ventas12m)} />
        <Kpi icon={TrendingUp} label="Pipeline ponderado" value={fmt(totales.pipeline)} />
        <Kpi icon={Target} label="Oportunidades abiertas" value={totales.oport} />
        <Kpi icon={Users} label="Ganadas (valor)" value={fmt(totales.ganadasValor)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking por ejecutivo</CardTitle>
          <CardDescription>
            Ventas ERP son las últimas 12 meses; visitas cuenta los últimos 30 días.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ejecutivo</TableHead>
                  <TableHead className="text-right">Cartera</TableHead>
                  <TableHead className="text-right">Ventas 12m</TableHead>
                  <TableHead className="text-right">Clientes facturados</TableHead>
                  <TableHead className="text-right">Pipeline pond.</TableHead>
                  <TableHead className="text-right">Oport. abiertas</TableHead>
                  <TableHead className="text-right">Ganadas</TableHead>
                  <TableHead className="text-right">Conversión</TableHead>
                  <TableHead className="text-right">Visitas 30d</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .slice()
                  .sort((a, b) => b.ventas12m - a.ventas12m)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nombre}</TableCell>
                      <TableCell className="text-right">{r.cartera}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(r.ventas12m)}</TableCell>
                      <TableCell className="text-right">{r.clientesFacturados}</TableCell>
                      <TableCell className="text-right">{fmt(r.pipelinePond)}</TableCell>
                      <TableCell className="text-right">{r.oportAbiertas}</TableCell>
                      <TableCell className="text-right">{r.ganadas}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.conversion >= 40 ? "default" : "secondary"}>
                          {r.conversion.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground text-xs">{r.visitasReal}/</span>{r.visitas}
                      </TableCell>
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

function Kpi({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold mt-1">{value}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}