import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Target, Truck, TrendingUp, ArrowRight, Loader2, FileText, TriangleAlert, Sunrise, Map, BarChart3, DollarSign } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Line, LineChart, Pie, PieChart, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(n || 0);
const NUM = (n: number) => new Intl.NumberFormat("es-PE").format(n || 0);

const ESTADO_OP_LABEL: Record<string, string> = {
  prospeccion: "Prospección",
  calificada: "Calificada",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  ganada: "Ganada",
  perdida: "Perdida",
};

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#22c55e", "#f59e0b", "#ef4444", "#6366f1"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "short" });
}
function last6Months() {
  const arr: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(monthKey(d));
  }
  return arr;
}

function Dashboard() {
  const { user, roles, isAdmin } = useAuth();
  const nombre = (user?.user_metadata?.nombre as string) || user?.email?.split("@")[0] || "";
  const rolLabel = roles[0] ?? "sin rol";

  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<any[]>([]);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [envios, setEnvios] = useState<any[]>([]);
  const [cotizaciones, setCotizaciones] = useState<any[]>([]);
  const [seguimientos, setSeguimientos] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const sinceIso = since.toISOString().slice(0, 10);

      const [c, o, e, q, s] = await Promise.all([
        supabase.from("clientes").select("id, area_comercial, categoria_cliente, canal, estado, created_at"),
        supabase.from("oportunidades").select("id, estado, monto_estimado, probabilidad, fecha_cierre_estimada, created_at"),
        supabase.from("envios").select("id, fecha, importe, peso_kg, estado, cliente_id").gte("fecha", sinceIso),
        supabase.from("cotizaciones").select("id, estado, total, fecha_emision, fecha_vencimiento").gte("fecha_emision", sinceIso),
        supabase.from("seguimientos").select("id, fecha, tipo, resultado"),
      ]);
      if (cancel) return;
      setClientes(c.data ?? []);
      setOportunidades(o.data ?? []);
      setEnvios(e.data ?? []);
      setCotizaciones(q.data ?? []);
      setSeguimientos(s.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const now = new Date();
    const mk = monthKey(now);
    const enviosMes = envios.filter((x) => monthKey(new Date(x.fecha)) === mk);
    const ventasMes = enviosMes.reduce((a, x) => a + Number(x.importe || 0), 0);
    const opAbiertas = oportunidades.filter((o) => !["ganada", "perdida"].includes(o.estado));
    const pipeline = opAbiertas.reduce(
      (a, o) => a + Number(o.monto_estimado || 0) * (Number(o.probabilidad || 0) / 100),
      0
    );
    const cotVigentes = cotizaciones.filter((c) => ["enviada", "pendiente"].includes(c.estado)).length;
    return {
      clientes: clientes.filter((c) => c.estado === "activo").length,
      opAbiertas: opAbiertas.length,
      enviosMes: enviosMes.length,
      ventasMes,
      pipeline,
      cotVigentes,
    };
  }, [clientes, oportunidades, envios, cotizaciones]);

  const ventasChart = useMemo(() => {
    const months = last6Months();
    const map = new Map(months.map((m) => [m, { mes: monthLabel(m), ventas: 0, envios: 0 }]));
    envios.forEach((x) => {
      const k = monthKey(new Date(x.fecha));
      const row = map.get(k);
      if (row) {
        row.ventas += Number(x.importe || 0);
        row.envios += 1;
      }
    });
    return Array.from(map.values());
  }, [envios]);

  const pipelineChart = useMemo(() => {
    const orden = ["prospeccion", "calificada", "propuesta", "negociacion", "ganada", "perdida"];
    return orden.map((estado) => {
      const items = oportunidades.filter((o) => o.estado === estado);
      return {
        etapa: ESTADO_OP_LABEL[estado],
        cantidad: items.length,
        monto: items.reduce((a, o) => a + Number(o.monto_estimado || 0), 0),
      };
    });
  }, [oportunidades]);

  const areaChart = useMemo(() => {
    const g: Record<string, number> = {};
    clientes.forEach((c) => {
      const k = c.area_comercial || "sin_area";
      g[k] = (g[k] || 0) + 1;
    });
    return Object.entries(g).map(([k, v]) => ({ name: k, value: v }));
  }, [clientes]);

  const alertas = useMemo(() => {
    const arr: { label: string; tone: string }[] = [];
    const hoy = new Date();
    const en7 = new Date(hoy);
    en7.setDate(hoy.getDate() + 7);
    const cerrarProx = oportunidades.filter((o) => {
      if (!o.fecha_cierre_estimada || ["ganada", "perdida"].includes(o.estado)) return false;
      const d = new Date(o.fecha_cierre_estimada);
      return d >= hoy && d <= en7;
    }).length;
    if (cerrarProx) arr.push({ label: `${cerrarProx} oportunidades cierran esta semana`, tone: "text-amber-600" });
    const cotVencidas = cotizaciones.filter((c) => {
      if (!c.fecha_vencimiento || ["aceptada", "rechazada"].includes(c.estado)) return false;
      return new Date(c.fecha_vencimiento) < hoy;
    }).length;
    if (cotVencidas) arr.push({ label: `${cotVencidas} cotizaciones vencidas por revisar`, tone: "text-red-600" });
    const sinSeguimiento = clientes.filter((c) => c.estado === "activo").length -
      new Set(seguimientos.map((s) => s.id)).size;
    if (sinSeguimiento > 0 && seguimientos.length === 0)
      arr.push({ label: `Aún no registras seguimientos comerciales`, tone: "text-muted-foreground" });
    return arr;
  }, [oportunidades, cotizaciones, clientes, seguimientos]);

  const KPI = [
    { label: "Clientes activos", icon: Users, value: NUM(kpis.clientes) },
    { label: "Oportunidades abiertas", icon: Target, value: NUM(kpis.opAbiertas) },
    { label: "Envíos del mes", icon: Truck, value: NUM(kpis.enviosMes) },
    { label: "Ventas del mes", icon: TrendingUp, value: PEN(kpis.ventasMes) },
    { label: "Pipeline ponderado", icon: TrendingUp, value: PEN(kpis.pipeline) },
    { label: "Cotizaciones vigentes", icon: FileText, value: NUM(kpis.cotVigentes) },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground capitalize">{rolLabel}</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">¡Hola, {nombre}! 👋</h1>
        <p className="text-muted-foreground mt-1">Panel comercial de Cruz del Sur Cargo.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando indicadores…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {KPI.map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <k.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl lg:text-2xl font-bold mt-2 tabular-nums">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {alertas.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="h-4 w-4 text-amber-600" /> Alertas
                </div>
                <ul className="text-sm ml-6 list-disc">
                  {alertas.map((a, i) => (
                    <li key={i} className={a.tone}>{a.label}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por mes</CardTitle>
                <CardDescription>Facturación de envíos, últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ ventas: { label: "Ventas", color: "hsl(var(--primary))" } }}
                  className="h-[260px] w-full"
                >
                  <LineChart data={ventasChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" />
                    <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v: any) => PEN(Number(v))} />} />
                    <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pipeline por etapa</CardTitle>
                <CardDescription>Cantidad de oportunidades por estado</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ cantidad: { label: "Oportunidades", color: "hsl(var(--primary))" } }}
                  className="h-[260px] w-full"
                >
                  <BarChart data={pipelineChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="etapa" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="cantidad" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Envíos por mes</CardTitle>
                <CardDescription>Volumen de envíos, últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ envios: { label: "Envíos", color: "hsl(var(--accent))" } }}
                  className="h-[260px] w-full"
                >
                  <BarChart data={ventasChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="mes" />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="envios" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clientes por área comercial</CardTitle>
                <CardDescription>Distribución de la cartera</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[260px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={areaChart} dataKey="value" nameKey="name" outerRadius={90} label>
                      {areaChart.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild><Link to="/mi-dia"><Sunrise className="h-4 w-4 mr-2" />Mi día</Link></Button>
            <Button asChild variant="outline"><Link to="/rutas"><Map className="h-4 w-4 mr-2" />Rutas de la semana</Link></Button>
            <Button asChild variant="outline"><Link to="/clientes">Ver clientes</Link></Button>
            <Button asChild variant="outline"><Link to="/oportunidades">Ver oportunidades</Link></Button>
            <Button asChild variant="outline"><Link to="/comisiones"><DollarSign className="h-4 w-4 mr-2" />Comisiones</Link></Button>
            {(isAdmin) && (
              <Button asChild variant="outline"><Link to="/reportes"><BarChart3 className="h-4 w-4 mr-2" />Reportes gerenciales</Link></Button>
            )}
            {isAdmin && (
              <Button asChild variant="outline">
                <a href="/admin/usuarios">Gestionar usuarios <ArrowRight className="h-4 w-4 ml-2" /></a>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
