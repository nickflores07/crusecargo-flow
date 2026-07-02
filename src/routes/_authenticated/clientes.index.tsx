import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, User as UserIcon, Plus, Upload, Search, Loader2, Users } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clientes/")({
  component: ClientesList,
});

type Cliente = {
  id: string;
  tipo: "empresa" | "persona";
  razon_social: string | null;
  nombre_completo: string | null;
  ruc: string | null;
  dni: string | null;
  ciudad: string | null;
  telefono: string | null;
  correo: string | null;
  estado: "prospecto" | "en_negociacion" | "activo" | "inactivo" | "perdido";
  created_at: string;
  sector_id: string | null;
  ejecutivo_id: string | null;
};

type Sector = { id: string; nombre: string };
type Ejecutivo = { id: string; nombre: string };

const estadoColor: Record<string, string> = {
  prospecto: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  en_negociacion: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  activo: "bg-green-500/10 text-green-700 dark:text-green-300",
  inactivo: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  perdido: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const ESTADO_LABELS: Record<string, string> = {
  prospecto: "Prospecto",
  en_negociacion: "En negociación",
  activo: "Activo",
  inactivo: "Inactivo",
  perdido: "Perdido",
};

function ClientesList() {
  const { isAdmin, isSupervisor } = useAuth();
  const canReassign = isAdmin || isSupervisor;
  const [rows, setRows] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [sectorFilter, setSectorFilter] = useState<string>("todos");
  const [ejecutivoFilter, setEjecutivoFilter] = useState<string>("todos");
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [ejecutivos, setEjecutivos] = useState<Ejecutivo[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: secs }, { data: profs }] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, tipo, razon_social, nombre_completo, ruc, dni, ciudad, telefono, correo, estado, created_at, sector_id, ejecutivo_id")
        .order("created_at", { ascending: false }),
      supabase.from("sectores").select("id, nombre").order("nombre"),
      supabase.from("profiles").select("id, nombre").order("nombre"),
    ]);
    if (error) toast.error("No pudimos cargar los clientes");
    setRows((data as Cliente[]) ?? []);
    setSectores(secs ?? []);
    setEjecutivos(profs ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipoFilter !== "todos" && r.tipo !== tipoFilter) return false;
      if (estadoFilter !== "todos" && r.estado !== estadoFilter) return false;
      if (sectorFilter !== "todos") {
        if (sectorFilter === "__none__") { if (r.sector_id) return false; }
        else if (r.sector_id !== sectorFilter) return false;
      }
      if (ejecutivoFilter !== "todos") {
        if (ejecutivoFilter === "__none__") { if (r.ejecutivo_id) return false; }
        else if (r.ejecutivo_id !== ejecutivoFilter) return false;
      }
      if (!term) return true;
      const hay = [r.razon_social, r.nombre_completo, r.ruc, r.dni, r.correo, r.telefono, r.ciudad]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q, tipoFilter, estadoFilter, sectorFilter, ejecutivoFilter]);

  const sectoresMap = useMemo(() => new Map(sectores.map((s) => [s.id, s.nombre])), [sectores]);
  const ejecutivosMap = useMemo(() => new Map(ejecutivos.map((e) => [e.id, e.nombre])), [ejecutivos]);

  const updateEstado = async (id: string, nuevo: Cliente["estado"]) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, estado: nuevo } : x)));
    const { error } = await supabase.from("clientes").update({ estado: nuevo }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("No se pudo actualizar: " + error.message);
    } else {
      toast.success("Estado actualizado");
    }
  };

  const updateEjecutivo = async (id: string, ejecutivoId: string | null) => {
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ejecutivo_id: ejecutivoId } : x)));
    const { error } = await supabase.from("clientes").update({ ejecutivo_id: ejecutivoId }).eq("id", id);
    if (error) {
      setRows(prev);
      toast.error("No se pudo reasignar: " + error.message);
    } else {
      toast.success("Ejecutivo asignado");
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestiona empresas y personas de tu cartera.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/clientes/importar"><Upload className="h-4 w-4" /> Importar Excel</Link>
          </Button>
          <Button asChild>
            <Link to="/clientes/nuevo"><Plus className="h-4 w-4" /> Nuevo cliente</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, RUC, DNI, correo..." className="pl-9" />
            </div>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="empresa">Cliente Institucional</SelectItem>
                <SelectItem value="persona">Cliente Común</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="prospecto">Prospecto</SelectItem>
                <SelectItem value="en_negociacion">En negociación</SelectItem>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="inactivo">Inactivo</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos los sectores</SelectItem>
                <SelectItem value="__none__">Sin sector</SelectItem>
                {sectores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ejecutivoFilter} onValueChange={setEjecutivoFilter}>
              <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="todos">Todos los ejecutivos</SelectItem>
                <SelectItem value="__none__">Sin asignar</SelectItem>
                {ejecutivos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-lg">
              <Users className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">
                {rows.length === 0 ? "Aún no tienes clientes" : "Sin resultados"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
                {rows.length === 0
                  ? "Crea tu primer cliente o importa desde un Excel para empezar."
                  : "Ajusta los filtros o la búsqueda."}
              </p>
              {rows.length === 0 && (
                <div className="flex gap-2 justify-center mt-4">
                  <Button asChild><Link to="/clientes/nuevo"><Plus className="h-4 w-4" /> Nuevo cliente</Link></Button>
                  <Button asChild variant="outline"><Link to="/clientes/importar"><Upload className="h-4 w-4" /> Importar</Link></Button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => {
                const nombre = c.tipo === "empresa" ? c.razon_social : c.nombre_completo;
                const doc = c.tipo === "empresa" ? c.ruc : c.dni;
                const Icon = c.tipo === "empresa" ? Building2 : UserIcon;
                return (
                  <div key={c.id} className="flex items-center gap-3 py-3 hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{nombre || "(sin nombre)"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[doc, c.ciudad, c.correo, c.sector_id ? sectoresMap.get(c.sector_id) : null].filter(Boolean).join(" · ") || "Sin datos adicionales"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          Ejecutivo: {c.ejecutivo_id ? (ejecutivosMap.get(c.ejecutivo_id) ?? "—") : <span className="text-amber-600">sin asignar</span>}
                        </p>
                      </div>
                    </Link>
                    {canReassign && (
                      <Select
                        value={c.ejecutivo_id ?? "__none__"}
                        onValueChange={(v) => void updateEjecutivo(c.id, v === "__none__" ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-[170px] text-xs" title="Reasignar ejecutivo">
                          <SelectValue placeholder="Sin asignar">
                            {c.ejecutivo_id ? (ejecutivosMap.get(c.ejecutivo_id) ?? "—") : "Sin asignar"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="__none__">Sin asignar</SelectItem>
                          {ejecutivos.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={c.estado} onValueChange={(v) => void updateEstado(c.id, v as Cliente["estado"])}>
                      <SelectTrigger
                        className={`h-8 w-[150px] text-xs capitalize border ${estadoColor[c.estado] ?? ""}`}
                        title="Cambiar estado sin abrir la ficha"
                      >
                        <SelectValue>{ESTADO_LABELS[c.estado]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ESTADO_LABELS).map(([k, l]) => (
                          <SelectItem key={k} value={k}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Mostrando {filtered.length} de {rows.length}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}