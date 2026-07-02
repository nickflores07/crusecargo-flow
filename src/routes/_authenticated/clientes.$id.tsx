import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Loader2, Building2, User as UserIcon, Save, Trash2, Plus,
} from "lucide-react";
import { ClienteForm, type ClienteFormValues } from "@/components/clientes/cliente-form";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  component: ClienteDetalle,
});

type ClienteRow = {
  id: string;
  tipo: "empresa" | "persona";
  razon_social: string | null;
  ruc: string | null;
  rubro: string | null;
  nombre_completo: string | null;
  dni: string | null;
  direccion: string | null;
  ciudad: string | null;
  telefono: string | null;
  correo: string | null;
  estado: "prospecto" | "activo" | "inactivo" | "perdido";
  notas: string | null;
};

function ClienteDetalle() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast.error("No se encontró el cliente");
      setLoading(false);
      return;
    }
    setCliente(data as ClienteRow);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const handleSave = async (v: ClienteFormValues) => {
    setSaving(true);
    const { error } = await supabase.from("clientes").update({
      razon_social: v.tipo === "empresa" ? v.razon_social || null : null,
      ruc: v.tipo === "empresa" ? v.ruc || null : null,
      rubro: v.tipo === "empresa" ? v.rubro || null : null,
      nombre_completo: v.tipo === "persona" ? v.nombre_completo || null : null,
      dni: v.tipo === "persona" ? v.dni || null : null,
      direccion: v.direccion || null,
      ciudad: v.ciudad || null,
      telefono: v.telefono || null,
      correo: v.correo || null,
      estado: v.estado,
      notas: v.notas || null,
    }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("No se pudo guardar: " + error.message);
      return;
    }
    toast.success("Cambios guardados");
    void load();
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Cliente eliminado");
    void navigate({ to: "/clientes" });
  };

  if (loading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!cliente) {
    return (
      <div className="text-center py-16">
        <p>Cliente no encontrado.</p>
        <Button asChild variant="link"><Link to="/clientes">Volver</Link></Button>
      </div>
    );
  }

  const nombre = cliente.tipo === "empresa" ? cliente.razon_social : cliente.nombre_completo;
  const Icon = cliente.tipo === "empresa" ? Building2 : UserIcon;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes"><ArrowLeft className="h-4 w-4" /> Volver a clientes</Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate">{nombre || "(sin nombre)"}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">
                    {cliente.tipo === "empresa" ? "Empresa" : "Persona"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{cliente.estado}</Badge>
                </CardDescription>
              </div>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">Datos generales</TabsTrigger>
          <TabsTrigger value="comercial">Datos comerciales</TabsTrigger>
          {cliente.tipo === "empresa" ? (
            <TabsTrigger value="contactos">Contactos</TabsTrigger>
          ) : (
            <TabsTrigger value="direcciones">Direcciones</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ClienteForm
                initial={{
                  tipo: cliente.tipo,
                  razon_social: cliente.razon_social ?? "",
                  ruc: cliente.ruc ?? "",
                  rubro: cliente.rubro ?? "",
                  nombre_completo: cliente.nombre_completo ?? "",
                  dni: cliente.dni ?? "",
                  direccion: cliente.direccion ?? "",
                  ciudad: cliente.ciudad ?? "",
                  telefono: cliente.telefono ?? "",
                  correo: cliente.correo ?? "",
                  estado: cliente.estado,
                  notas: cliente.notas ?? "",
                }}
                submitting={saving}
                onSubmit={handleSave}
                submitLabel="Guardar cambios"
                lockTipo
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comercial" className="mt-4">
          <DatosComerciales clienteId={id} />
        </TabsContent>

        {cliente.tipo === "empresa" ? (
          <TabsContent value="contactos" className="mt-4">
            <Contactos clienteId={id} />
          </TabsContent>
        ) : (
          <TabsContent value="direcciones" className="mt-4">
            <Direcciones clienteId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

type DatosComRow = {
  volumen_envios_mes: number | null;
  peso_promedio_kg: number | null;
  zonas_frecuentes: string | null;
  tipo_paquete: string | null;
  frecuencia_envio: string | null;
  tarifa_negociada: number | null;
  contrato: boolean;
  facturacion_mensual_estimada: number | null;
  competidor_actual: string | null;
  observaciones: string | null;
};

const emptyDatosCom: DatosComRow = {
  volumen_envios_mes: null, peso_promedio_kg: null, zonas_frecuentes: null,
  tipo_paquete: null, frecuencia_envio: null, tarifa_negociada: null,
  contrato: false, facturacion_mensual_estimada: null,
  competidor_actual: null, observaciones: null,
};

function DatosComerciales({ clienteId }: { clienteId: string }) {
  const [row, setRow] = useState<DatosComRow>(emptyDatosCom);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("datos_comerciales_cliente")
        .select("*").eq("cliente_id", clienteId).maybeSingle();
      if (data) setRow(data as DatosComRow);
      setLoading(false);
    })();
  }, [clienteId]);

  const set = <K extends keyof DatosComRow>(k: K, v: DatosComRow[K]) =>
    setRow((s) => ({ ...s, [k]: v }));

  const num = (s: string) => (s === "" ? null : Number(s));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("datos_comerciales_cliente")
      .upsert({ cliente_id: clienteId, ...row }, { onConflict: "cliente_id" });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar: " + error.message);
    toast.success("Datos comerciales guardados");
  };

  if (loading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perfil comercial</CardTitle>
        <CardDescription>Volumen, tarifa y datos de negocio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Volumen de envíos por mes</Label>
            <Input type="number" value={row.volumen_envios_mes ?? ""} onChange={(e) => set("volumen_envios_mes", num(e.target.value))} />
          </div>
          <div>
            <Label>Peso promedio (kg)</Label>
            <Input type="number" step="0.01" value={row.peso_promedio_kg ?? ""} onChange={(e) => set("peso_promedio_kg", num(e.target.value))} />
          </div>
          <div>
            <Label>Zonas frecuentes</Label>
            <Input value={row.zonas_frecuentes ?? ""} onChange={(e) => set("zonas_frecuentes", e.target.value)} placeholder="Lima Norte, Callao..." />
          </div>
          <div>
            <Label>Tipo de paquete</Label>
            <Input value={row.tipo_paquete ?? ""} onChange={(e) => set("tipo_paquete", e.target.value)} placeholder="Documento, caja, frágil..." />
          </div>
          <div>
            <Label>Frecuencia de envío</Label>
            <Input value={row.frecuencia_envio ?? ""} onChange={(e) => set("frecuencia_envio", e.target.value)} placeholder="Diaria, semanal..." />
          </div>
          <div>
            <Label>Tarifa negociada (S/)</Label>
            <Input type="number" step="0.01" value={row.tarifa_negociada ?? ""} onChange={(e) => set("tarifa_negociada", num(e.target.value))} />
          </div>
          <div>
            <Label>Facturación mensual estimada (S/)</Label>
            <Input type="number" step="0.01" value={row.facturacion_mensual_estimada ?? ""} onChange={(e) => set("facturacion_mensual_estimada", num(e.target.value))} />
          </div>
          <div>
            <Label>Competidor actual</Label>
            <Input value={row.competidor_actual ?? ""} onChange={(e) => set("competidor_actual", e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="contrato" checked={row.contrato} onCheckedChange={(v) => set("contrato", Boolean(v))} />
          <Label htmlFor="contrato">Tiene contrato firmado</Label>
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={3} value={row.observaciones ?? ""} onChange={(e) => set("observaciones", e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Contactos({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Array<{ id: string; nombre: string; cargo: string | null; celular: string | null; correo: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ nombre: "", cargo: "", celular: "", correo: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("contactos").select("id, nombre, cargo, celular, correo").eq("cliente_id", clienteId).order("created_at");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clienteId]);

  const add = async () => {
    if (!nuevo.nombre.trim()) return toast.error("El nombre es obligatorio");
    setAdding(true);
    const { error } = await supabase.from("contactos").insert({ cliente_id: clienteId, ...nuevo });
    setAdding(false);
    if (error) return toast.error("No se pudo agregar: " + error.message);
    setNuevo({ nombre: "", cargo: "", celular: "", correo: "" });
    toast.success("Contacto agregado");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("contactos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contactos de la empresa</CardTitle>
        <CardDescription>Personas con las que hablas dentro del cliente.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aún no hay contactos.</p>
        ) : (
          <div className="divide-y">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.cargo, c.celular, c.correo].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">Agregar contacto</p>
          <div className="grid md:grid-cols-2 gap-2">
            <Input placeholder="Nombre *" value={nuevo.nombre} onChange={(e) => setNuevo((s) => ({ ...s, nombre: e.target.value }))} />
            <Input placeholder="Cargo" value={nuevo.cargo} onChange={(e) => setNuevo((s) => ({ ...s, cargo: e.target.value }))} />
            <Input placeholder="Celular" value={nuevo.celular} onChange={(e) => setNuevo((s) => ({ ...s, celular: e.target.value }))} />
            <Input placeholder="Correo" value={nuevo.correo} onChange={(e) => setNuevo((s) => ({ ...s, correo: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={adding} size="sm">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Direcciones({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Array<{ id: string; etiqueta: string | null; direccion: string; ciudad: string | null; referencia: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState({ etiqueta: "", direccion: "", ciudad: "", referencia: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("direcciones_entrega").select("id, etiqueta, direccion, ciudad, referencia").eq("cliente_id", clienteId).order("created_at");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clienteId]);

  const add = async () => {
    if (!nuevo.direccion.trim()) return toast.error("La dirección es obligatoria");
    setAdding(true);
    const { error } = await supabase.from("direcciones_entrega").insert({ cliente_id: clienteId, ...nuevo });
    setAdding(false);
    if (error) return toast.error(error.message);
    setNuevo({ etiqueta: "", direccion: "", ciudad: "", referencia: "" });
    toast.success("Dirección agregada");
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("direcciones_entrega").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Direcciones de entrega</CardTitle>
        <CardDescription>Ubicaciones donde se realizan los envíos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aún no hay direcciones.</p>
        ) : (
          <div className="divide-y">
            {items.map((d) => (
              <div key={d.id} className="flex items-start gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.etiqueta || "Sin etiqueta"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[d.direccion, d.ciudad, d.referencia].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-medium">Agregar dirección</p>
          <div className="grid md:grid-cols-2 gap-2">
            <Input placeholder="Etiqueta (Casa, Oficina...)" value={nuevo.etiqueta} onChange={(e) => setNuevo((s) => ({ ...s, etiqueta: e.target.value }))} />
            <Input placeholder="Ciudad" value={nuevo.ciudad} onChange={(e) => setNuevo((s) => ({ ...s, ciudad: e.target.value }))} />
            <Input placeholder="Dirección *" value={nuevo.direccion} onChange={(e) => setNuevo((s) => ({ ...s, direccion: e.target.value }))} className="md:col-span-2" />
            <Input placeholder="Referencia" value={nuevo.referencia} onChange={(e) => setNuevo((s) => ({ ...s, referencia: e.target.value }))} className="md:col-span-2" />
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={adding} size="sm">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}