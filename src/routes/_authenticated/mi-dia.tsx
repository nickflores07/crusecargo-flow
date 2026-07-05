import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sunrise, AlertCircle, CalendarClock, Phone, FileText, Building2,
  User as UserIcon, Loader2, TrendingUp, Target, MessageSquare, Calendar as CalendarIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { RegistrarContactoDialog } from "@/components/mi-dia/registrar-contacto-dialog";

export const Route = createFileRoute("/_authenticated/mi-dia")({
  component: MiDia,
});

type ClienteBrief = {
  id: string;
  tipo: "empresa" | "persona";
  razon_social: string | null;
  nombre_completo: string | null;
  ciudad: string | null;
  telefono: string | null;
  correo: string | null;
  estado: string;
  proximo_contacto_en: string | null;
  ultimo_contacto_en: string | null;
  valor_estimado_mensual: number | null;
  probabilidad_cierre: number;
  ejecutivo_id: string | null;
};

type CotSinRespuesta = {
  id: string;
  numero: string;
  total: number;
  enviada_en: string;
  enviada_a: string | null;
  cliente_id: string;
  cliente_nombre: string;
};

type VisitaSemana = {
  id: string;
  fecha_planificada: string;
  hora: string | null;
  tipo: string;
  motivo: string | null;
  estado: string;
  cliente_id: string;
  cliente_nombre: string;
};

type OpCierre = {
  id: string;
  titulo: string;
  fecha_cierre_estimada: string;
  probabilidad: number;
  cliente_id: string;
  cliente_nombre: string;
};

function nombre(c: Pick<ClienteBrief, "tipo" | "razon_social" | "nombre_completo">) {
  return (c.tipo === "empresa" ? c.razon_social : c.nombre_completo) ?? "(sin nombre)";
}

function fmtSoles(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 0 }).format(Number(n));
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const t = new Date(fecha + "T00:00:00");
  return Math.round((t.getTime() - hoy.getTime()) / 86400000);
}

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function MiDia() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const seeAll = isAdmin || isSupervisor;
  const [nombreEjec, setNombreEjec] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState<ClienteBrief[]>([]);
  const [cotSinResp, setCotSinResp] = useState<CotSinRespuesta[]>([]);
  const [dialogCliente, setDialogCliente] = useState<ClienteBrief | null>(null);
  const [visitasSemana, setVisitasSemana] = useState<VisitaSemana[]>([]);
  const [opsCierre, setOpsCierre] = useState<OpCierre[]>([]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);

    if (!nombreEjec) {
      const { data: prof } = await supabase.from("profiles").select("nombre").eq("id", user.id).maybeSingle();
      if (prof?.nombre) setNombreEjec(prof.nombre);
    }

    const clientesQ = supabase.from("clientes")
      .select("id, tipo, razon_social, nombre_completo, ciudad, telefono, correo, estado, proximo_contacto_en, ultimo_contacto_en, valor_estimado_mensual, probabilidad_cierre, ejecutivo_id")
      .in("estado", ["prospecto", "en_negociacion", "activo"]);

    const cotQ = supabase.from("cotizaciones")
      .select("id, numero, total, enviada_en, enviada_a, cliente_id, ejecutivo_id, clientes:cliente_id(tipo, razon_social, nombre_completo)")
      .eq("estado", "enviada")
      .not("enviada_en", "is", null)
      .order("enviada_en", { ascending: true });

    // Semana Lun→Dom para agenda
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const lunes = new Date(hoy0); lunes.setDate(hoy0.getDate() - ((hoy0.getDay() + 6) % 7));
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const visQ = supabase.from("visitas_planificadas")
      .select("id, fecha_planificada, hora, tipo, motivo, estado, cliente_id, ejecutivo_id, clientes:cliente_id(tipo, razon_social, nombre_completo)")
      .gte("fecha_planificada", ymd(lunes))
      .lte("fecha_planificada", ymd(domingo))
      .order("fecha_planificada").order("hora");

    const opCierreQ = supabase.from("oportunidades")
      .select("id, titulo, fecha_cierre_estimada, probabilidad, cliente_id, ejecutivo_id, clientes:cliente_id(tipo, razon_social, nombre_completo)")
      .eq("estado", "en_proceso")
      .not("fecha_cierre_estimada", "is", null)
      .gte("fecha_cierre_estimada", ymd(lunes))
      .lte("fecha_cierre_estimada", ymd(domingo))
      .order("fecha_cierre_estimada");

    const [cliRes, cotRes, visRes, opRes] = await Promise.all([
      seeAll ? clientesQ : clientesQ.eq("ejecutivo_id", user.id),
      seeAll ? cotQ : cotQ.eq("ejecutivo_id", user.id),
      seeAll ? visQ : visQ.eq("ejecutivo_id", user.id),
      seeAll ? opCierreQ : opCierreQ.eq("ejecutivo_id", user.id),
    ]);

    if (cliRes.error) toast.error("No pudimos cargar tus clientes");
    setClientes((cliRes.data as ClienteBrief[]) ?? []);

    const visMapped: VisitaSemana[] = ((visRes.data as Array<{
      id: string; fecha_planificada: string; hora: string | null; tipo: string;
      motivo: string | null; estado: string; cliente_id: string;
      clientes: { tipo: "empresa" | "persona"; razon_social: string | null; nombre_completo: string | null } | null;
    }>) ?? []).map((v) => ({
      id: v.id, fecha_planificada: v.fecha_planificada, hora: v.hora, tipo: v.tipo,
      motivo: v.motivo, estado: v.estado, cliente_id: v.cliente_id,
      cliente_nombre: v.clientes ? nombre(v.clientes) : "Cliente",
    }));
    setVisitasSemana(visMapped);

    const opMapped: OpCierre[] = ((opRes.data as Array<{
      id: string; titulo: string; fecha_cierre_estimada: string; probabilidad: number; cliente_id: string;
      clientes: { tipo: "empresa" | "persona"; razon_social: string | null; nombre_completo: string | null } | null;
    }>) ?? []).map((o) => ({
      id: o.id, titulo: o.titulo, fecha_cierre_estimada: o.fecha_cierre_estimada,
      probabilidad: o.probabilidad, cliente_id: o.cliente_id,
      cliente_nombre: o.clientes ? nombre(o.clientes) : "Cliente",
    }));
    setOpsCierre(opMapped);

    const cutoff = Date.now() - 5 * 86400000;
    const cots: CotSinRespuesta[] = ((cotRes.data as Array<{
      id: string; numero: string; total: number; enviada_en: string; enviada_a: string | null;
      cliente_id: string; clientes: { tipo: "empresa" | "persona"; razon_social: string | null; nombre_completo: string | null } | null;
    }>) ?? [])
      .filter((c) => c.enviada_en && new Date(c.enviada_en).getTime() < cutoff)
      .map((c) => ({
        id: c.id, numero: c.numero, total: Number(c.total), enviada_en: c.enviada_en, enviada_a: c.enviada_a,
        cliente_id: c.cliente_id,
        cliente_nombre: c.clientes ? nombre(c.clientes) : "—",
      }));
    setCotSinResp(cots);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id, seeAll]);

  const buckets = useMemo(() => {
    const vencidos: ClienteBrief[] = [];
    const hoy: ClienteBrief[] = [];
    const proximos: ClienteBrief[] = [];
    const sinContacto: ClienteBrief[] = [];
    for (const c of clientes) {
      const d = diasHasta(c.proximo_contacto_en);
      if (d === null) { sinContacto.push(c); continue; }
      if (d < 0) vencidos.push(c);
      else if (d === 0) hoy.push(c);
      else if (d <= 3) proximos.push(c);
    }
    const cmp = (a: ClienteBrief, b: ClienteBrief) =>
      (a.proximo_contacto_en ?? "").localeCompare(b.proximo_contacto_en ?? "");
    return {
      vencidos: vencidos.sort(cmp),
      hoy: hoy.sort(cmp),
      proximos: proximos.sort(cmp),
      sinContacto: sinContacto.slice(0, 8),
    };
  }, [clientes]);

  const kpis = useMemo(() => {
    const abiertos = clientes.filter((c) => c.estado !== "activo");
    const pipeline = abiertos.reduce((s, c) => s + (Number(c.valor_estimado_mensual ?? 0) * (c.probabilidad_cierre / 100)), 0);
    return {
      pendientes: buckets.vencidos.length + buckets.hoy.length,
      vencidos: buckets.vencidos.length,
      cotPendientes: cotSinResp.length,
      pipeline,
    };
  }, [clientes, buckets, cotSinResp]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sunrise className="h-6 w-6 text-primary" /> {saludo()}{nombreEjec ? `, ${nombreEjec.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Estos son tus clientes por contactar hoy y el estado de tus cotizaciones pendientes.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={CalendarClock} label="Por contactar hoy" value={String(kpis.pendientes)} tone={kpis.pendientes > 0 ? "primary" : "ok"} />
        <Kpi icon={AlertCircle} label="Vencidos" value={String(kpis.vencidos)} tone={kpis.vencidos > 0 ? "warn" : "ok"} />
        <Kpi icon={FileText} label="Cotizaciones sin respuesta" value={String(kpis.cotPendientes)} tone={kpis.cotPendientes > 0 ? "warn" : "ok"} hint=">5 días enviadas" />
        <Kpi icon={TrendingUp} label="Mi pipeline" value={fmtSoles(kpis.pipeline)} hint="Ponderado por probabilidad" />
      </div>

      {loading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgendaSemanal
            visitas={visitasSemana}
            opsCierre={opsCierre}
            cotizaciones={cotSinResp}
            clientesConProximo={clientes}
          />
          <Bucket
            title="Vencidos"
            description="Prometiste contactar antes de hoy. Priorízalos."
            icon={AlertCircle} tone="warn" items={buckets.vencidos}
            onRegistrar={setDialogCliente}
          />
          <Bucket
            title="Hoy"
            description="Contactos programados para hoy."
            icon={CalendarClock} tone="primary" items={buckets.hoy}
            onRegistrar={setDialogCliente}
          />
          <Bucket
            title="Próximos 3 días"
            description="Ve preparando el terreno."
            icon={Target} tone="ok" items={buckets.proximos}
            onRegistrar={setDialogCliente}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-amber-600" /> Cotizaciones sin respuesta
              </CardTitle>
              <CardDescription>Enviadas hace más de 5 días. Es buen momento para dar seguimiento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {cotSinResp.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay cotizaciones sin respuesta 🎉</p>
              ) : cotSinResp.map((c) => {
                const dias = Math.round((Date.now() - new Date(c.enviada_en).getTime()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 border rounded-md p-2.5 hover:bg-muted/30">
                    <Link to="/cotizaciones/$id" params={{ id: c.id }} className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{c.numero} · {c.cliente_nombre}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {fmtSoles(c.total)} · Enviada hace {dias}d{c.enviada_a ? ` a ${c.enviada_a}` : ""}
                      </div>
                    </Link>
                    <Badge variant="outline" className="text-[10px]">{dias}d</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {buckets.sinContacto.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" /> Clientes sin fecha de próximo contacto
                </CardTitle>
                <CardDescription>Programa un próximo contacto para no perderlos de vista (máx. 8 mostrados).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {buckets.sinContacto.map((c) => (
                  <ClienteRow key={c.id} c={c} onRegistrar={setDialogCliente} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {dialogCliente && (
        <RegistrarContactoDialog
          clienteId={dialogCliente.id}
          clienteNombre={nombre(dialogCliente)}
          estadoCliente={dialogCliente.estado}
          open={!!dialogCliente}
          onOpenChange={(v) => !v && setDialogCliente(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = "ok" }: {
  icon: typeof Sunrise; label: string; value: string; hint?: string;
  tone?: "ok" | "warn" | "primary";
}) {
  const toneCls = tone === "warn" ? "text-amber-600" : tone === "primary" ? "text-primary" : "";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${toneCls}`} /> <span>{label}</span>
        </div>
        <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Bucket({ title, description, icon: Icon, tone, items, onRegistrar }: {
  title: string; description: string; icon: typeof Sunrise; tone: "ok" | "warn" | "primary";
  items: ClienteBrief[]; onRegistrar: (c: ClienteBrief) => void;
}) {
  const iconTone = tone === "warn" ? "text-red-600" : tone === "primary" ? "text-primary" : "text-emerald-600";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${iconTone}`} /> {title}
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nada por aquí ✔️</p>
        ) : items.map((c) => (
          <ClienteRow key={c.id} c={c} onRegistrar={onRegistrar} />
        ))}
      </CardContent>
    </Card>
  );
}

function AgendaSemanal({
  visitas, opsCierre, cotizaciones, clientesConProximo,
}: {
  visitas: VisitaSemana[];
  opsCierre: OpCierre[];
  cotizaciones: CotSinRespuesta[];
  clientesConProximo: ClienteBrief[];
}) {
  const DAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy0); lunes.setDate(hoy0.getDate() - ((hoy0.getDay() + 6) % 7));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    return d;
  });
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hoyKey = ymd(hoy0);

  type Evento = { hora: string | null; label: string; sub: string; tone: string; href?: { to: string; params?: Record<string, string> } };
  const byDay: Record<string, Evento[]> = {};
  dias.forEach((d) => { byDay[ymd(d)] = []; });

  visitas.forEach((v) => {
    if (byDay[v.fecha_planificada]) {
      byDay[v.fecha_planificada].push({
        hora: v.hora,
        label: v.cliente_nombre,
        sub: `${v.tipo}${v.motivo ? " · " + v.motivo : ""}`,
        tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
      });
    }
  });
  opsCierre.forEach((o) => {
    if (byDay[o.fecha_cierre_estimada]) {
      byDay[o.fecha_cierre_estimada].push({
        hora: null,
        label: `🎯 ${o.titulo}`,
        sub: `${o.cliente_nombre} · ${o.probabilidad}%`,
        tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
      });
    }
  });
  clientesConProximo.forEach((c) => {
    if (c.proximo_contacto_en && byDay[c.proximo_contacto_en]) {
      const nom = (c.tipo === "empresa" ? c.razon_social : c.nombre_completo) ?? "Cliente";
      byDay[c.proximo_contacto_en].push({
        hora: null,
        label: `📞 ${nom}`,
        sub: "Próximo contacto",
        tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
      });
    }
  });
  cotizaciones.forEach((c) => {
    const key = c.enviada_en.slice(0, 10);
    if (byDay[key]) {
      byDay[key].push({
        hora: null,
        label: `📄 ${c.numero}`,
        sub: `${c.cliente_nombre} · esperando respuesta`,
        tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      });
    }
  });

  Object.values(byDay).forEach((list) => list.sort((a, b) => (a.hora ?? "z").localeCompare(b.hora ?? "z")));

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarIcon className="h-4 w-4 text-primary" /> Agenda de la semana
        </CardTitle>
        <CardDescription>
          Visitas del Plan Semanal, cierres de oportunidades, próximos contactos y cotizaciones en espera.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {dias.map((d, i) => {
            const key = ymd(d);
            const items = byDay[key];
            const esHoy = key === hoyKey;
            return (
              <div key={key} className={`rounded-md border p-1.5 min-h-[110px] ${esHoy ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-baseline justify-between mb-1 px-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{DAYS_SHORT[i]}</span>
                  <span className={`text-xs font-semibold ${esHoy ? "text-primary" : ""}`}>{d.getDate()}</span>
                </div>
                <div className="space-y-1">
                  {items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic px-0.5">—</p>
                  ) : items.slice(0, 4).map((ev, idx) => (
                    <div key={idx} className={`rounded px-1.5 py-1 text-[10px] border ${ev.tone}`}>
                      <p className="font-medium truncate leading-tight">{ev.hora ? ev.hora.slice(0, 5) + " " : ""}{ev.label}</p>
                      <p className="opacity-75 truncate leading-tight">{ev.sub}</p>
                    </div>
                  ))}
                  {items.length > 4 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{items.length - 4} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-blue-500/60" /> Visita/Actividad</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500/60" /> Cierre oportunidad</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-violet-500/60" /> Próximo contacto</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500/60" /> Cotización en espera</span>
          <Link to="/rutas" className="ml-auto text-primary hover:underline">Ir al Plan Semanal →</Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ClienteRow({ c, onRegistrar }: { c: ClienteBrief; onRegistrar: (c: ClienteBrief) => void }) {
  const Icon = c.tipo === "empresa" ? Building2 : UserIcon;
  const dias = diasHasta(c.proximo_contacto_en);
  const diasTxt =
    dias === null ? "Sin fecha"
    : dias < 0 ? `Vencido ${Math.abs(dias)}d`
    : dias === 0 ? "Hoy"
    : `En ${dias}d`;
  const diasTone =
    dias === null ? "text-muted-foreground"
    : dias < 0 ? "text-red-600"
    : dias === 0 ? "text-primary"
    : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 border rounded-md p-2 hover:bg-muted/30">
      <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-2 flex-1 min-w-0">
        <div className="h-8 w-8 rounded bg-primary/10 grid place-items-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{nombre(c)}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {[c.ciudad, c.telefono, c.correo].filter(Boolean).join(" · ") || "Sin contacto"}
          </div>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <span className={`text-[11px] ${diasTone}`}>{diasTxt}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onRegistrar(c)}>
          <Phone className="h-3 w-3" /> Registrar
        </Button>
      </div>
    </div>
  );
}