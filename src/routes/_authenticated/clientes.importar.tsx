import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/importar")({
  component: ImportarClientes,
});

type Campo = {
  key: string;
  label: string;
  aliases: string[];
};

const CAMPOS: Campo[] = [
  { key: "tipo", label: "Tipo (empresa/persona)", aliases: ["tipo", "tipo cliente", "tipo_cliente"] },
  { key: "razon_social", label: "Razón social", aliases: ["razon social", "razón social", "empresa", "razon_social"] },
  { key: "ruc", label: "RUC", aliases: ["ruc"] },
  { key: "rubro", label: "Rubro", aliases: ["rubro", "industria"] },
  { key: "nombre_completo", label: "Nombre completo", aliases: ["nombre completo", "nombre", "cliente"] },
  { key: "dni", label: "DNI", aliases: ["dni", "documento"] },
  { key: "direccion", label: "Dirección", aliases: ["direccion", "dirección"] },
  { key: "ciudad", label: "Ciudad", aliases: ["ciudad", "distrito"] },
  { key: "telefono", label: "Teléfono", aliases: ["telefono", "teléfono", "celular", "movil", "móvil"] },
  { key: "correo", label: "Correo", aliases: ["correo", "email", "e-mail"] },
  { key: "estado", label: "Estado", aliases: ["estado", "status"] },
  { key: "notas", label: "Notas", aliases: ["notas", "observaciones", "comentarios"] },
];

const NORM = (s: string) =>
  s.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function autoMap(headers: string[]) {
  const map: Record<string, string> = {};
  for (const campo of CAMPOS) {
    const found = headers.find((h) => campo.aliases.some((a) => NORM(h) === NORM(a)));
    if (found) map[campo.key] = found;
  }
  return map;
}

type Row = Record<string, unknown>;
type PreviewRow = {
  raw: Row;
  tipo: "empresa" | "persona";
  identificador: string | null;
  nombre: string;
  duplicado: boolean;
  error: string | null;
};

function ImportarClientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ creados: number; actualizados: number; errores: number; log: string[] } | null>(null);
  const [existingDocs, setExistingDocs] = useState<Set<string>>(new Set());

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
    if (json.length === 0) {
      toast.error("El archivo está vacío");
      return;
    }
    const hdrs = Object.keys(json[0]);
    setHeaders(hdrs);
    setRows(json);
    setMapping(autoMap(hdrs));
    // fetch existing docs to detect duplicates
    const { data } = await supabase.from("clientes").select("ruc, dni");
    const set = new Set<string>();
    (data ?? []).forEach((r) => {
      if (r.ruc) set.add("ruc:" + r.ruc);
      if (r.dni) set.add("dni:" + r.dni);
    });
    setExistingDocs(set);
    setStep(2);
  };

  const getVal = (row: Row, key: string): string => {
    const col = mapping[key];
    if (!col) return "";
    const v = row[col];
    return v == null ? "" : String(v).trim();
  };

  const preview = useMemo<PreviewRow[]>(() => {
    if (step < 3) return [];
    return rows.map((r) => {
      const tipoRaw = NORM(getVal(r, "tipo"));
      const tipo: "empresa" | "persona" =
        tipoRaw.startsWith("p") || tipoRaw === "persona" || tipoRaw === "b2c" ? "persona" : "empresa";
      const ruc = getVal(r, "ruc");
      const dni = getVal(r, "dni");
      const razon = getVal(r, "razon_social");
      const nombreP = getVal(r, "nombre_completo");
      const nombre = tipo === "empresa" ? razon || nombreP : nombreP || razon;
      const identificador = tipo === "empresa" ? ruc || null : dni || null;
      let error: string | null = null;
      if (!nombre) error = tipo === "empresa" ? "Falta razón social" : "Falta nombre";
      const dupKey = tipo === "empresa" ? (ruc ? "ruc:" + ruc : null) : (dni ? "dni:" + dni : null);
      const duplicado = dupKey ? existingDocs.has(dupKey) : false;
      return { raw: r, tipo, identificador, nombre, duplicado, error };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rows, mapping, existingDocs]);

  const validCount = preview.filter((p) => !p.error).length;
  const dupCount = preview.filter((p) => p.duplicado).length;
  const errCount = preview.filter((p) => p.error).length;

  const runImport = async () => {
    setImporting(true);
    const log: string[] = [];
    let creados = 0, actualizados = 0, errores = 0;

    for (let i = 0; i < preview.length; i++) {
      const p = preview[i];
      if (p.error) { errores++; log.push(`Fila ${i + 2}: ${p.error}`); continue; }
      const r = p.raw;
      const payload: Record<string, unknown> = {
        tipo: p.tipo,
        razon_social: p.tipo === "empresa" ? getVal(r, "razon_social") || null : null,
        ruc: p.tipo === "empresa" ? getVal(r, "ruc") || null : null,
        rubro: p.tipo === "empresa" ? getVal(r, "rubro") || null : null,
        nombre_completo: p.tipo === "persona" ? getVal(r, "nombre_completo") || null : null,
        dni: p.tipo === "persona" ? getVal(r, "dni") || null : null,
        direccion: getVal(r, "direccion") || null,
        ciudad: getVal(r, "ciudad") || null,
        telefono: getVal(r, "telefono") || null,
        correo: getVal(r, "correo") || null,
        notas: getVal(r, "notas") || null,
        ejecutivo_id: user?.id ?? null,
        created_by: user?.id ?? null,
      };
      const estado = NORM(getVal(r, "estado"));
      if (["prospecto", "activo", "inactivo", "perdido"].includes(estado)) payload.estado = estado;

      if (p.duplicado && p.identificador) {
        const col = p.tipo === "empresa" ? "ruc" : "dni";
        const { error } = await supabase.from("clientes").update(payload).eq(col, p.identificador);
        if (error) { errores++; log.push(`Fila ${i + 2}: ${error.message}`); }
        else { actualizados++; }
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) { errores++; log.push(`Fila ${i + 2}: ${error.message}`); }
        else { creados++; }
      }
    }

    await supabase.from("importaciones_clientes").insert({
      user_id: user!.id,
      archivo_nombre: fileName,
      total: preview.length,
      creados, actualizados, errores,
      log: log.length ? { errores: log } : null,
    });

    setImporting(false);
    setResult({ creados, actualizados, errores, log });
    setStep(4);
  };

  const downloadPlantilla = () => {
    const ws = XLSX.utils.json_to_sheet([{
      tipo: "empresa", razon_social: "Ejemplo S.A.C.", ruc: "20123456789",
      rubro: "Retail", nombre_completo: "", dni: "",
      direccion: "Av. Ejemplo 123", ciudad: "Lima",
      telefono: "999999999", correo: "contacto@ejemplo.com",
      estado: "prospecto", notas: "",
    }, {
      tipo: "persona", razon_social: "", ruc: "",
      rubro: "", nombre_completo: "Juan Pérez", dni: "12345678",
      direccion: "Calle Falsa 456", ciudad: "Arequipa",
      telefono: "988888888", correo: "juan@correo.com",
      estado: "prospecto", notas: "",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "plantilla-clientes.xlsx");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Volver a clientes</Link>
      </Button>

      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: "Archivo" },
          { n: 2, label: "Mapeo" },
          { n: 3, label: "Revisar" },
          { n: 4, label: "Listo" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-medium ${
              step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{s.n}</div>
            <span className={step >= s.n ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            {i < 3 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Sube tu archivo Excel</CardTitle>
            <CardDescription>Formato .xlsx o .xls. La primera fila debe ser los encabezados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="mt-2 font-medium">Haz clic para elegir un archivo</p>
              <p className="text-xs text-muted-foreground">o arrástralo aquí</p>
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </label>
            <div className="flex justify-center">
              <Button variant="link" size="sm" onClick={downloadPlantilla}>
                <Download className="h-4 w-4" /> Descargar plantilla de ejemplo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirma el mapeo de columnas</CardTitle>
            <CardDescription>
              <FileSpreadsheet className="h-4 w-4 inline mr-1" />
              {fileName} · {rows.length} filas · Detectamos {Object.keys(mapping).length} columnas automáticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {CAMPOS.map((c) => (
                <div key={c.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-sm">{c.label}</Label>
                  <Select
                    value={mapping[c.key] ?? "__none__"}
                    onValueChange={(v) => setMapping((m) => {
                      const nm = { ...m };
                      if (v === "__none__") delete nm[c.key];
                      else nm[c.key] = v;
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
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Volver</Button>
              <Button onClick={() => setStep(3)}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisa antes de importar</CardTitle>
            <CardDescription>Verifica los primeros registros y marca duplicados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{validCount}</p>
                <p className="text-xs text-muted-foreground">Válidos</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-blue-600">{dupCount}</p>
                <p className="text-xs text-muted-foreground">Duplicados (se actualizarán)</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-red-600">{errCount}</p>
                <p className="text-xs text-muted-foreground">Con errores (se omiten)</p>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Tipo</th>
                    <th className="text-left p-2">Nombre</th>
                    <th className="text-left p-2">Doc.</th>
                    <th className="text-left p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground">{i + 2}</td>
                      <td className="p-2 capitalize">{p.tipo}</td>
                      <td className="p-2">{p.nombre || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2 text-muted-foreground">{p.identificador ?? "—"}</td>
                      <td className="p-2">
                        {p.error ? (
                          <Badge variant="destructive" className="text-[10px]">{p.error}</Badge>
                        ) : p.duplicado ? (
                          <Badge variant="outline" className="text-[10px]">Actualizar</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-green-700">Crear</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 50 && (
                <p className="text-xs text-muted-foreground text-center p-2">Mostrando primeros 50 de {preview.length}.</p>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={importing}>Volver</Button>
              <Button onClick={runImport} disabled={importing || validCount + dupCount === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {validCount + dupCount} registros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle>Importación completada</CardTitle>
                <CardDescription>Ya puedes ver los clientes en el listado.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-green-600">{result.creados}</p>
                <p className="text-xs text-muted-foreground">Creados</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-blue-600">{result.actualizados}</p>
                <p className="text-xs text-muted-foreground">Actualizados</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-2xl font-bold text-red-600">{result.errores}</p>
                <p className="text-xs text-muted-foreground">Errores</p>
              </div>
            </div>
            {result.log.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 max-h-40 overflow-auto">
                <p className="text-xs font-medium mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Detalle de errores
                </p>
                {result.log.map((l, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{l}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setStep(1); setRows([]); setResult(null); setFileName(""); }}>
                Importar otro
              </Button>
              <Button onClick={() => navigate({ to: "/clientes" })}>Ver clientes</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}