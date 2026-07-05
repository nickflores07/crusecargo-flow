import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Building2, User as UserIcon, Search, Loader2, Target, TrendingUp,
  CalendarClock, AlertCircle, Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/prospeccion")({
  component: ProspeccionKanban,
});

type Estado = "prospecto" | "en_negociacion" | "activo" | "perdido";

type Cliente = {
  id: string;
  tipo: "empresa" | "persona";
  razon_social: string | null;
  nombre_completo: string | null;
  ruc: string | null;
  dni: string | null;
  ciudad: string | null;
  correo: string | null;
  telefono: string | null;
  estado: Estado | "inactivo";
  ejecutivo_id: string | null;
  fuente_prospeccion: string | null;
  probabilidad_cierre: number;
  valor_estimado_mensual: number | null;
  proximo_contacto_en: string | null;
  ultimo_contacto_en: string | null;
  created_at: string;
};

type Ejecutivo = { id: string; nombre: string };

const COLUMNAS: { key: Estado; label: string; color: string; accent: string }[] = [
  { key: "prospecto", label: "Prospecto", color: "bg-blue-500/10", accent: "border-blue-500/30" },
  { key: "en_negociacion", label: "En negociación", color: "bg-amber-500/10", accent: "border-amber-500/30" },
  { key: "activo", label: "Ganado / Activo", color: "bg-emerald-500/10", accent: "border-emerald-500/30" },
  { key: "perdido", label: "Perdido", color: "bg-red-500/10", accent: "border-red-500/30" },
];

const FUENTES = [
  { value: "referido", label: "Referido" },
  { value: "web", label: "Web / Formulario" },
  { value: "cold_call", label: "Llamada en frío" },
  { value: "feria", label: "Feria / Evento" },
  { value: "campaña", label: "Campaña marketing" },
  { value: "otro", label: "Otro" },
];

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

function ProspeccionKanban() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const canSeeAll = isAdmin || isSupervisor;
  const [rows, setRows] = useState<Cliente[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ejecutivoFilter, setEjecutivoFilter] = useState<string>("todos");
  const [fuenteFilter, setFuenteFilter] = useState<string>("todos");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Estado | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase.from("clientes")
        .select("id, tipo, razon_social, nombre_completo, ruc, dni, ciudad, correo, telefono, estado, ejecutivo_id, fuente_prospeccion, probabilidad_cierre, valor_estimado_mensual, proximo_contacto_en, ultimo_contacto_en, created_at")
        .in("estado", ["prospecto", "en_negociacion", "activo", "perdido"])
        .order("proximo_contacto_en", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("id, nombre").order("nombre"),
    ]);
    if (error) toast.error("No pudimos cargar prospectos");
    setRows((data as Cliente[]) ?? []);
    setEjecutivos(profs ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!canSeeAll && user?.id) setEjecutivoFilter(user.id);
  }, [canSeeAll, user?.id]);

  const ejecutivosMap = useMemo(() => new Map(ejecutivos.map((e) => [e.id, e.nombre])), [ejecutivos]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (ejecutivoFilter !== "todos" && r.ejecutivo_id !== ejecutivoFilter) return false;
      if (fuenteFilter !== "todos" && r.fuente_prospeccion !== fuenteFilter) return false;
      if (!term) return true;
      const hay = [r.razon_social, r.nombre_completo, r.ruc, r.dni, r.correo, r.ciudad].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, ejecutivoFilter, fuenteFilter]);

  const porColumna = useMemo(() => {
    const m: Record<Estado, Cliente[]> = { prospecto: [], en_negociacion: [], activo: [], perdido: [] };
    for (const c of filtered) {
      if (c.estado === "inactivo") continue;
      m[c.estado].push(c);
    }
    return m;
  }, [filtered]);

  const kpis = useMemo(() => {
    const abiertos = filtered.filter((c) => c.estado === "prospecto" || c.estado === "en_negociacion");
    const pipeline = abiertos.reduce((s, c) => s + (Number(c.valor_estimado_mensual ?? 0) * (c.probabilidad_cierre / 100)), 0);
    const bruto = abiertos.reduce((s, c) => s + Number(c.valor_estimado_mensual ?? 0), 0);
    const ganados = filtered.filter((c) => c.estado === "activo").length;
    const perdidos = filtered.filter((c) => c.estado === "perdido").length;
    const total = ganados + perdidos;
    const conv = total > 0 ? Math.round((ganados / total) * 100) : 0;
    const vencidos = abiertos.filter((c) => {
      const d = diasHasta(c.proximo_contacto_en);
      return d !== null && d < 0;
    }).length;
    return { abiertos: abiertos.length, pipeline, bruto, conv, vencidos };
  }, [filtered]);

  const moverA = async (id: string, nuevo: Estado) => {
    const target = rows.find((r) => r.id === id);
    if (!target || target.estado === nuevo) return;
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado: nuevo } : x)));
    const { error } = await supabase.from("clientes").update({ estado: nuevo }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("No se pudo mover: " + error.message);
    } else {
      toast.success(`Movido a ${nuevo.replace("_", " ")}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Prospección
          </h1>
          <p className="text-sm text-muted-foreground">Embudo comercial en tiempo real. Arrastra tarjetas para cambiar la etapa.</p>
        </div>
        <Button asChild>
          <Link to="/clientes/nuevo"><Plus className="h-4 w-4" /> Nuevo prospecto</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Target} label="Abiertos" value={String(kpis.abiertos)} hint="Prospecto + Negociación" />
        <KpiCard icon={TrendingUp} label="Pipeline ponderado" value={fmtSoles(kpis.pipeline)} hint="Valor × probabilidad" />
        <KpiCard icon={TrendingUp} label="Pipeline bruto" value={fmtSoles(kpis.bruto)} hint="Sin ponderar" />
        <KpiCard icon={TrendingUp} label="Conversión" value={`${kpis.conv}%`} hint="Ganados / (ganados + perdidos)" />
        <KpiCard icon={AlertCircle} label="Contacto vencido" value={String(kpis.vencidos)} hint="Próximo contacto pasado" tone={kpis.vencidos > 0 ? "warn" : "ok"} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, RUC, correo..." className="pl-9" />
            </div>
            <Select value={ejecutivoFilter} onValueChange={setEjecutivoFilter} disabled={!canSeeAll}>
              <SelectTrigger><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {canSeeAll && <SelectItem value="todos">Todos los ejecutivos</SelectItem>}
                {ejecutivos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fuenteFilter} onValueChange={setFuenteFilter}>
              <SelectTrigger><SelectValue placeholder="Fuente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las fuentes</SelectItem>
                {FUENTES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                <SelectItem value="__none__">Sin fuente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNAS.map((col) => {
            const items = porColumna[col.key];
            const total = items.reduce((s, c) => s + Number(c.valor_estimado_mensual ?? 0), 0);
            const isOver = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={() => setDragOver((v) => (v === col.key ? null : v))}
                onDrop={() => {
                  setDragOver(null);
                  if (dragId) void moverA(dragId, col.key);
                  setDragId(null);
                }}
                className={`rounded-lg border ${col.accent} ${col.color} ${isOver ? "ring-2 ring-primary" : ""} flex flex-col min-h-[300px]`}
              >
                <div className="p-3 border-b border-border/40 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{col.label}</div>
                    <div className="text-[11px] text-muted-foreground">{items.length} · {fmtSoles(total)}</div>
                  </div>
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                  {items.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">
                      Sin tarjetas aquí
                    </div>
                  )}
                  {items.map((c) => (
                    <ProspectCard
                      key={c.id}
                      c={c}
                      ejecutivosMap={ejecutivosMap}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, hint, tone = "ok" }: {
  icon: typeof Target; label: string; value: string; hint?: string; tone?: "ok" | "warn";
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3.5 w-3.5 ${tone === "warn" ? "text-amber-600" : ""}`} />
          <span>{label}</span>
        </div>
        <div className={`text-xl font-semibold mt-1 ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ProspectCard({ c, ejecutivosMap, onDragStart, onDragEnd }: {
  c: Cliente;
  ejecutivosMap: Map<string, string>;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const nombre = c.tipo === "empresa" ? c.razon_social : c.nombre_completo;
  const doc = c.tipo === "empresa" ? c.ruc : c.dni;
  const Icon = c.tipo === "empresa" ? Building2 : UserIcon;
  const dias = diasHasta(c.proximo_contacto_en);
  const contactoTone =
    dias === null ? "text-muted-foreground"
    : dias < 0 ? "text-red-600"
    : dias <= 2 ? "text-amber-600"
    : "text-muted-foreground";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-md bg-background border p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
    >
      <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-start gap-2">
        <div className="h-7 w-7 rounded bg-primary/10 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{nombre || "(sin nombre)"}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {[doc, c.ciudad].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </Link>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">{fmtSoles(c.valor_estimado_mensual)}</div>
        <Badge variant="outline" className="text-[10px] h-5">
          {c.probabilidad_cierre}%
        </Badge>
      </div>

      {(c.proximo_contacto_en || c.fuente_prospeccion) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
          {c.proximo_contacto_en ? (
            <span className={`flex items-center gap-1 ${contactoTone}`}>
              <CalendarClock className="h-3 w-3" />
              {dias === null ? "—"
                : dias < 0 ? `Vencido ${Math.abs(dias)}d`
                : dias === 0 ? "Hoy"
                : `En ${dias}d`}
            </span>
          ) : <span />}
          {c.fuente_prospeccion && (
            <Badge variant="secondary" className="text-[10px] h-5 capitalize">
              {c.fuente_prospeccion.replace("_", " ")}
            </Badge>
          )}
        </div>
      )}

      {c.ejecutivo_id && (
        <div className="mt-1.5 text-[10px] text-muted-foreground truncate">
          {ejecutivosMap.get(c.ejecutivo_id) ?? "—"}
        </div>
      )}
    </div>
  );
}