import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Database, Upload, Loader2, ShieldAlert, CheckCircle2, AlertCircle, FileSpreadsheet, CalendarRange, Building2, Users2, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/erp")({
  component: AdminERP,
});

type BatchTipo = "ventas_comunes" | "ventas_institucionales" | "cotizaciones";

const TIPO_LABEL: Record<BatchTipo, string> = {
  ventas_comunes: "Ventas Comunes",
  ventas_institucionales: "Ventas Institucionales",
  cotizaciones: "Cotizaciones",
};

const TIPO_DESC: Record<BatchTipo, string> = {
  ventas_comunes: "Facturación de clientes comunes (mes a mes).",
  ventas_institucionales: "Facturación de clientes institucionales / B2B (mes a mes).",
  cotizaciones: "Historial de cotizaciones emitidas desde el ERP (rango amplio).",
};

const TIPO_ICON: Record<BatchTipo, typeof Users2> = {
  ventas_comunes: Users2,
  ventas_institucionales: Building2,
  cotizaciones: FileText,
};

type BatchRow = {
  id: string;
  tipo: BatchTipo;
  archivo_nombre: string;
  total: number;
  ok: number;
  errores: number;
  notas: string | null;
  created_at: string;
  uploaded_by: string;
};

type BatchWithProc = BatchRow & { procesadas: number };

type MapRow = {
  id: string;
  nombre_erp: string;
  codigo_erp: string | null;
  profile_id: string | null;
  activo: boolean;
};

type Profile = { id: string; nombre: string };

const NORM = (s: string) =>
  s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mapeo automático de encabezados frecuentes del ERP
const ALIASES: Record<string, string[]> = {
  fecha: ["fecha", "fecha emision", "fecha de emision", "fec_emision", "fec emision"],
  ruc: ["ruc", "ruc cliente", "ruc/dni", "documento"],
  cliente_nombre: ["cliente", "razon social", "razón social", "nombre cliente", "cliente nombre"],
  ejecutivo_erp: ["ejecutivo", "asesor", "vendedor", "asesor comercial", "ejecutivo comercial", "cod_vendedor", "codigo vendedor"],
  servicio: ["servicio", "producto", "linea", "línea", "modalidad"],
  origen: ["origen", "ciudad origen", "sucursal origen"],
  destino: ["destino", "ciudad destino", "sucursal destino"],
  guia_numero: ["guia", "guía", "numero guia", "número guía", "n° guia", "nro guia", "documento numero"],
  monto: ["monto", "importe", "total", "venta", "importe total", "monto total"],
  moneda: ["moneda", "mon", "divisa"],
  peso_kg: ["peso", "kg", "peso kg", "peso (kg)"],
};

const FIELD_LABEL: Record<string, string> = {
  fecha: "Fecha emisión ★",
  ruc: "RUC / Documento",
  cliente_nombre: "Cliente",
  ejecutivo_erp: "Ejecutivo",
  servicio: "Servicio",
  origen: "Origen",
  destino: "Destino",
  guia_numero: "N° Guía / Documento",
  monto: "Monto",
  moneda: "Moneda",
  peso_kg: "Peso (kg)",
};

function autoMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    const found = headers.find((h) => aliases.some((a) => NORM(h) === NORM(a)));
    if (found) map[key] = found;
  }
  return map;
}

function toDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const iso = new Date(Date.UTC(d.y, (d.m ?? 1) - 1, d.d ?? 1)).toISOString().slice(0, 10);
    return iso;
  }
  const s = String(v).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? null : n;
}

function AdminERP() {
  const { user, isAdmin, isSupervisor, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const puede = isAdmin || isSupervisor;

  useEffect(() => {
    if (!authLoading && !puede) navigate({ to: "/" });
  }, [authLoading, puede, navigate]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <Database className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold font-display">ERP / Cargas</h1>
          <p className="text-sm text-muted-foreground">
            Sube tus Excel del ERP (Ventas Comunes, Ventas Institucionales y Cotizaciones) para armar el histórico del CRM.
          </p>
        </div>
      </div>

      {!puede ? (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
            <ShieldAlert className="h-5 w-5" /> Sección solo para administradores y supervisores.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="cargas">
          <TabsList>
            <TabsTrigger value="cargas">Cargas</TabsTrigger>
            <TabsTrigger value="mapeo">Mapeo de ejecutivos</TabsTrigger>
          </TabsList>
          <TabsContent value="cargas" className="space-y-4 pt-4">
            {user && <CargasTab userId={user.id} />}
          </TabsContent>
          <TabsContent value="mapeo" className="space-y-4 pt-4">
            <MapeoTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CargasTab({ userId }: { userId: string }) {
  const [tipo, setTipo] = useState<BatchTipo>("ventas_comunes");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [batches, setBatches] = useState<BatchWithProc[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("erp_import_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) toast.error(error.message);
    const list = (data as BatchRow[]) ?? [];
    // fetch procesadas count per batch (client-side aggregate)
    const withProc: BatchWithProc[] = [];
    for (const b of list) {
      const { count } = await supabase
        .from("erp_ventas_staging")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", b.id)
        .eq("procesado", true);
      withProc.push({ ...b, procesadas: count ?? 0 });
    }
    setBatches(withProc);
    setLoading(false);
  };

  const procesarBatch = async (id: string) => {
    setProcessingId(id);
    const { data, error } = await supabase.rpc("procesar_batch_erp", { _batch_id: id });
    if (error) toast.error(error.message);
    else {
      const r = Array.isArray(data) ? data[0] : data;
      toast.success(`Procesadas ${r?.procesadas ?? 0} · ${r?.con_cliente ?? 0} con cliente · ${r?.clientes_creados ?? 0} nuevos`);
      await loadBatches();
    }
    setProcessingId(null);
  };

  useEffect(() => { void loadBatches(); }, []);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (json.length === 0) return toast.error("El archivo está vacío");
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    setMapping(autoMap(hdrs));
  };

  const runUpload = async () => {
    if (!rows.length) return;
    setUploading(true);
    const { data: batch, error: bErr } = await supabase
      .from("erp_import_batches")
      .insert({
        tipo,
        archivo_nombre: fileName,
        uploaded_by: userId,
        total: rows.length,
      })
      .select("id")
      .single();
    if (bErr || !batch) {
      toast.error(bErr?.message ?? "No se pudo crear el batch");
      setUploading(false);
      return;
    }

    const get = (r: Record<string, unknown>, k: string) => {
      const c = mapping[k];
      if (!c) return null;
      const v = r[c];
      return v == null || v === "" ? null : v;
    };

    const chunks: unknown[][] = [];
    const size = 500;
    for (let i = 0; i < rows.length; i += size) {
      const slice = rows.slice(i, i + size).map((r) => ({
        batch_id: batch.id,
        fecha: toDate(get(r, "fecha")),
        ruc: get(r, "ruc") ? String(get(r, "ruc")).trim() : null,
        cliente_nombre: get(r, "cliente_nombre") ? String(get(r, "cliente_nombre")).trim() : null,
        ejecutivo_erp: get(r, "ejecutivo_erp") ? String(get(r, "ejecutivo_erp")).trim() : null,
        servicio: get(r, "servicio") ? String(get(r, "servicio")) : null,
        origen: get(r, "origen") ? String(get(r, "origen")) : null,
        destino: get(r, "destino") ? String(get(r, "destino")) : null,
        guia_numero: get(r, "guia_numero") ? String(get(r, "guia_numero")) : null,
        monto: toNumber(get(r, "monto")),
        moneda: get(r, "moneda") ? String(get(r, "moneda")).toUpperCase() : "PEN",
        peso_kg: toNumber(get(r, "peso_kg")),
        datos_raw: r,
      }));
      chunks.push(slice);
    }

    let ok = 0, errores = 0;
    for (const c of chunks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("erp_ventas_staging").insert(c as any);
      if (error) errores += c.length;
      else ok += c.length;
    }

    await supabase.from("erp_import_batches").update({ ok, errores }).eq("id", batch.id);

    toast.success(`Carga completa: ${ok} filas cargadas, ${errores} con error`);
    setRows([]); setHeaders([]); setMapping({}); setFileName("");
    await loadBatches();
    setUploading(false);
  };

  return (
    <>
      <PeriodoHistoricoPanel />
      <Card>
        <CardHeader>
          <CardTitle>Nueva carga</CardTitle>
          <CardDescription>
            Sube el Excel del ERP. La columna <b>Fecha emisión</b> define el período. Los datos se guardan en un área de staging y luego se cruzan con clientes y ejecutivos al presionar <b>Procesar</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div>
              <Label>Tipo de archivo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as BatchTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ventas_comunes">Ventas Comunes (mensual)</SelectItem>
                  <SelectItem value="ventas_institucionales">Ventas Institucionales (mensual)</SelectItem>
                  <SelectItem value="cotizaciones">Cotizaciones (rango amplio)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{TIPO_DESC[tipo]}</p>
            </div>
            <div className="md:col-span-2">
              <Label>Archivo Excel</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
              />
            </div>
          </div>

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName} · {rows.length} filas · {Object.keys(mapping).length} columnas detectadas
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {Object.entries(ALIASES).map(([k]) => (
                  <div key={k} className="grid grid-cols-2 gap-2 items-center">
                    <Label className="text-sm">{FIELD_LABEL[k] ?? k}</Label>
                    <Select
                      value={mapping[k] ?? "__none__"}
                      onValueChange={(v) => setMapping((m) => {
                        const nm = { ...m };
                        if (v === "__none__") delete nm[k]; else nm[k] = v;
                        return nm;
                      })}
                    >
                      <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Sin asignar —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRows([]); setHeaders([]); setMapping({}); setFileName(""); }}>
                  Cancelar
                </Button>
                <Button onClick={runUpload} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Cargar {rows.length} filas
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cargas recientes</CardTitle>
          <CardDescription>Últimos archivos subidos al staging.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : batches.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aún no hay cargas.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">OK</TableHead>
                  <TableHead className="text-right">Errores</TableHead>
                  <TableHead className="text-right">Procesadas</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{TIPO_LABEL[b.tipo as BatchTipo] ?? b.tipo}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{b.archivo_nombre}</TableCell>
                    <TableCell className="text-right">{b.total}</TableCell>
                    <TableCell className="text-right text-green-600 flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {b.ok}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {b.errores > 0 ? (
                        <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" />{b.errores}</span>
                      ) : b.errores}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={b.procesadas === b.ok && b.ok > 0 ? "default" : "secondary"}>
                        {b.procesadas}/{b.ok}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === b.id || b.ok === 0}
                        onClick={() => procesarBatch(b.id)}
                      >
                        {processingId === b.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : b.procesadas === b.ok && b.ok > 0 ? "Reprocesar" : "Procesar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

type PeriodoStat = {
  tipo: BatchTipo;
  filas: number;
  desde: string | null;
  hasta: string | null;
  ultima_carga: string | null;
};

function PeriodoHistoricoPanel() {
  const [stats, setStats] = useState<PeriodoStat[] | null>(null);

  useEffect(() => {
    (async () => {
      const tipos: BatchTipo[] = ["ventas_comunes", "ventas_institucionales", "cotizaciones"];
      const out: PeriodoStat[] = [];
      for (const t of tipos) {
        // Batches de este tipo
        const { data: bs } = await supabase
          .from("erp_import_batches")
          .select("id, created_at")
          .eq("tipo", t)
          .order("created_at", { ascending: false });
        const ids = (bs ?? []).map((b) => b.id);
        if (ids.length === 0) {
          out.push({ tipo: t, filas: 0, desde: null, hasta: null, ultima_carga: null });
          continue;
        }
        // Rango de fechas y conteo desde staging
        const [{ count }, { data: minRow }, { data: maxRow }] = await Promise.all([
          supabase.from("erp_ventas_staging").select("id", { count: "exact", head: true }).in("batch_id", ids).not("fecha", "is", null),
          supabase.from("erp_ventas_staging").select("fecha").in("batch_id", ids).not("fecha", "is", null).order("fecha", { ascending: true }).limit(1).maybeSingle(),
          supabase.from("erp_ventas_staging").select("fecha").in("batch_id", ids).not("fecha", "is", null).order("fecha", { ascending: false }).limit(1).maybeSingle(),
        ]);
        out.push({
          tipo: t,
          filas: count ?? 0,
          desde: (minRow as { fecha: string } | null)?.fecha ?? null,
          hasta: (maxRow as { fecha: string } | null)?.fecha ?? null,
          ultima_carga: bs![0].created_at,
        });
      }
      setStats(out);
    })();
  }, []);

  const fmtFecha = (s: string | null) =>
    s ? new Date(s + "T00:00:00").toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5" /> Período histórico cargado
        </CardTitle>
        <CardDescription>
          Rango de <b>Fecha emisión</b> disponible en el CRM por cada tipo de archivo. Los reportes y comisiones se calculan a partir de estos datos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <div className="text-sm text-muted-foreground">Calculando…</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {stats.map((s) => {
              const Icon = TIPO_ICON[s.tipo];
              return (
                <div key={s.tipo} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="font-medium">{TIPO_LABEL[s.tipo]}</p>
                  </div>
                  {s.filas === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin datos cargados aún.</p>
                  ) : (
                    <>
                      <div className="text-2xl font-bold tabular-nums">{s.filas.toLocaleString("es-PE")}</div>
                      <p className="text-xs text-muted-foreground">registros con fecha</p>
                      <div className="text-sm pt-1 border-t">
                        <div className="flex justify-between"><span className="text-muted-foreground">Desde</span><span className="font-medium">{fmtFecha(s.desde)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Hasta</span><span className="font-medium">{fmtFecha(s.hasta)}</span></div>
                        <div className="flex justify-between mt-1"><span className="text-muted-foreground">Última carga</span><span className="text-xs">{s.ultima_carga ? new Date(s.ultima_carga).toLocaleDateString("es-PE") : "—"}</span></div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MapeoTab() {
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: mp }, { data: pf }, { data: st }] = await Promise.all([
      supabase.from("erp_ejecutivos_map").select("*").order("nombre_erp"),
      supabase.from("profiles").select("id, nombre").order("nombre"),
      supabase.from("erp_ventas_staging").select("ejecutivo_erp").not("ejecutivo_erp", "is", null),
    ]);
    const mapa = (mp as MapRow[]) ?? [];
    setMaps(mapa);
    setProfiles((pf as Profile[]) ?? []);
    const mapped = new Set(mapa.map((m) => NORM(m.nombre_erp)));
    const distinct = new Set<string>();
    (st ?? []).forEach((r) => {
      const n = (r.ejecutivo_erp ?? "").trim();
      if (n && !mapped.has(NORM(n))) distinct.add(n);
    });
    setUnmapped(Array.from(distinct).sort());
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const createMap = async (nombre: string, profileId: string | null) => {
    const { error } = await supabase.from("erp_ejecutivos_map").insert({
      nombre_erp: nombre,
      profile_id: profileId,
    });
    if (error) toast.error(error.message);
    else { toast.success("Mapeo guardado"); await load(); }
  };

  const updateMap = async (id: string, profileId: string | null) => {
    const { error } = await supabase.from("erp_ejecutivos_map").update({ profile_id: profileId }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Actualizado"); await load(); }
  };

  const deleteMap = async (id: string) => {
    const { error } = await supabase.from("erp_ejecutivos_map").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); await load(); }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Ejecutivos del ERP sin mapear</CardTitle>
          <CardDescription>
            Nombres/códigos de ejecutivo que aparecen en las cargas y todavía no están vinculados a un usuario del CRM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : unmapped.length === 0 ? (
            <div className="text-sm text-muted-foreground">Todos los ejecutivos del ERP ya están mapeados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre en ERP</TableHead>
                  <TableHead>Vincular con usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmapped.map((n) => (
                  <UnmappedRow key={n} nombre={n} profiles={profiles} onSave={createMap} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapeos guardados</CardTitle>
          <CardDescription>{maps.length} ejecutivos vinculados.</CardDescription>
        </CardHeader>
        <CardContent>
          {maps.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aún no hay mapeos guardados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre en ERP</TableHead>
                  <TableHead>Usuario CRM</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maps.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nombre_erp}</TableCell>
                    <TableCell>
                      <Select
                        value={m.profile_id ?? "__none__"}
                        onValueChange={(v) => updateMap(m.id, v === "__none__" ? null : v)}
                      >
                        <SelectTrigger className="w-64"><SelectValue placeholder="— Sin asignar —" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Sin asignar —</SelectItem>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => deleteMap(m.id)}>Eliminar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function UnmappedRow({
  nombre, profiles, onSave,
}: { nombre: string; profiles: Profile[]; onSave: (nombre: string, profileId: string | null) => void }) {
  const [sel, setSel] = useState<string>("__none__");
  const suggestion = useMemo(() => {
    const n = NORM(nombre);
    return profiles.find((p) => NORM(p.nombre) === n || NORM(p.nombre).includes(n) || n.includes(NORM(p.nombre)));
  }, [nombre, profiles]);
  useEffect(() => { if (suggestion) setSel(suggestion.id); }, [suggestion]);
  return (
    <TableRow>
      <TableCell className="font-medium">{nombre}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Select value={sel} onValueChange={setSel}>
            <SelectTrigger className="w-64"><SelectValue placeholder="— Sin asignar —" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sin asignar —</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => onSave(nombre, sel === "__none__" ? null : sel)}>Guardar</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}