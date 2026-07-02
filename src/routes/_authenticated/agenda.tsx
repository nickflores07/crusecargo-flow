import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Target, FileText, Phone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agenda")({
  component: AgendaPage,
});

type Item = {
  key: string;
  fecha: string;
  kind: "seguimiento" | "oportunidad" | "cotizacion";
  titulo: string;
  descripcion: string;
  link: string;
  overdue: boolean;
};

const KIND_META: Record<Item["kind"], { label: string; icon: any; color: string }> = {
  seguimiento: { label: "Seguimiento", icon: Phone, color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  oportunidad: { label: "Oportunidad", icon: Target, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  cotizacion: { label: "Cotización", icon: FileText, color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
};

function AgendaPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const hoy = new Date();
      const desde = new Date(hoy); desde.setDate(hoy.getDate() - 7);
      const hasta = new Date(hoy); hasta.setDate(hoy.getDate() + 30);
      const dISO = desde.toISOString().slice(0, 10);
      const hISO = hasta.toISOString().slice(0, 10);

      const [s, o, c] = await Promise.all([
        supabase.from("seguimientos")
          .select("id, fecha, tipo, resultado, cliente_id, clientes(nombre_completo, razon_social)")
          .gte("fecha", dISO).lte("fecha", hISO).order("fecha", { ascending: true }),
        supabase.from("oportunidades")
          .select("id, titulo, fecha_cierre_estimada, estado, cliente_id, clientes(nombre_completo, razon_social)")
          .not("fecha_cierre_estimada", "is", null)
          .gte("fecha_cierre_estimada", dISO).lte("fecha_cierre_estimada", hISO)
          .order("fecha_cierre_estimada", { ascending: true }),
        supabase.from("cotizaciones")
          .select("id, numero, fecha_vencimiento, estado, cliente_id, clientes(nombre_completo, razon_social)")
          .not("fecha_vencimiento", "is", null)
          .gte("fecha_vencimiento", dISO).lte("fecha_vencimiento", hISO)
          .order("fecha_vencimiento", { ascending: true }),
      ]);
      if (cancel) return;

      const hoyKey = hoy.toISOString().slice(0, 10);
      const nombre = (row: any) => row.clientes?.nombre_completo || row.clientes?.razon_social || "Cliente";

      const arr: Item[] = [
        ...((s.data as any[]) ?? []).map((r) => ({
          key: `s-${r.id}`, fecha: r.fecha, kind: "seguimiento" as const,
          titulo: `${r.tipo || "Seguimiento"} — ${nombre(r)}`,
          descripcion: r.resultado || "Sin notas",
          link: `/clientes/${r.cliente_id}`,
          overdue: r.fecha < hoyKey,
        })),
        ...((o.data as any[]) ?? []).filter((r) => !["ganada", "perdida"].includes(r.estado)).map((r) => ({
          key: `o-${r.id}`, fecha: r.fecha_cierre_estimada, kind: "oportunidad" as const,
          titulo: `${r.titulo} — ${nombre(r)}`,
          descripcion: `Cierre estimado (${r.estado})`,
          link: `/oportunidades`,
          overdue: r.fecha_cierre_estimada < hoyKey,
        })),
        ...((c.data as any[]) ?? []).filter((r) => !["aceptada", "rechazada"].includes(r.estado)).map((r) => ({
          key: `c-${r.id}`, fecha: r.fecha_vencimiento, kind: "cotizacion" as const,
          titulo: `${r.numero} — ${nombre(r)}`,
          descripcion: `Vencimiento (${r.estado})`,
          link: `/clientes/${r.cliente_id}`,
          overdue: r.fecha_vencimiento < hoyKey,
        })),
      ].sort((a, b) => a.fecha.localeCompare(b.fecha));

      setItems(arr);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  const grouped = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const g: Record<string, Item[]> = { Vencidos: [], Hoy: [], "Próximos 7 días": [], "Este mes": [] };
    const en7 = new Date(); en7.setDate(new Date().getDate() + 7);
    const en7ISO = en7.toISOString().slice(0, 10);
    items.forEach((it) => {
      if (it.fecha < hoy) g.Vencidos.push(it);
      else if (it.fecha === hoy) g.Hoy.push(it);
      else if (it.fecha <= en7ISO) g["Próximos 7 días"].push(it);
      else g["Este mes"].push(it);
    });
    return g;
  }, [items]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calendar className="h-6 w-6" /> Agenda
        </h1>
        <p className="text-muted-foreground mt-1">Seguimientos, cierres y vencimientos de los próximos 30 días.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando agenda…
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No tienes actividades programadas. Registra un seguimiento o define fechas de cierre en tus oportunidades.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([bucket, list]) => list.length > 0 && (
            <Card key={bucket}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {bucket}
                  <Badge variant="secondary" className="text-[10px]">{list.length}</Badge>
                </CardTitle>
                {bucket === "Vencidos" && <CardDescription>Revisa lo pendiente de días anteriores.</CardDescription>}
              </CardHeader>
              <CardContent className="divide-y">
                {list.map((it) => {
                  const M = KIND_META[it.kind];
                  return (
                    <Link key={it.key} to={it.link} className="flex items-start gap-3 py-3 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors">
                      <div className={`h-8 w-8 rounded-md grid place-items-center ${M.color}`}>
                        <M.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{it.titulo}</span>
                          <Badge variant="outline" className="text-[10px]">{M.label}</Badge>
                          {it.overdue && <Badge variant="destructive" className="text-[10px]">Vencido</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{it.descripcion}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {new Date(it.fecha + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}