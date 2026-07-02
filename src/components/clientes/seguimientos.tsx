import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Phone, Mail, MessageCircle, MapPin, Users as UsersIcon, Plus, Trash2, CalendarClock } from "lucide-react";

type TipoInter = "llamada" | "visita" | "reunion" | "whatsapp" | "correo" | "otro";

type Seg = {
  id: string;
  tipo: TipoInter;
  fecha: string;
  resultado: string | null;
  compromiso: string | null;
  proxima_accion_fecha: string | null;
  proxima_accion_nota: string | null;
  usuario_id: string | null;
};

const TIPO_META: Record<TipoInter, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  llamada: { label: "Llamada", icon: Phone, color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  visita: { label: "Visita", icon: MapPin, color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  reunion: { label: "Reunión", icon: UsersIcon, color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  correo: { label: "Correo", icon: Mail, color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  otro: { label: "Otro", icon: MessageCircle, color: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
};

const empty = {
  tipo: "llamada" as TipoInter,
  fecha: new Date().toISOString().slice(0, 16),
  resultado: "",
  compromiso: "",
  proxima_accion_fecha: "",
  proxima_accion_nota: "",
};

export function Seguimientos({ clienteId }: { clienteId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Seg[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seguimientos")
      .select("id, tipo, fecha, resultado, compromiso, proxima_accion_fecha, proxima_accion_nota, usuario_id")
      .eq("cliente_id", clienteId)
      .order("fecha", { ascending: false });
    if (error) toast.error("No pudimos cargar el seguimiento");
    setItems((data as Seg[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clienteId]);

  const save = async () => {
    if (!form.resultado.trim()) return toast.error("Cuéntanos brevemente el resultado o comentario.");
    setSaving(true);
    const { error } = await supabase.from("seguimientos").insert({
      cliente_id: clienteId,
      usuario_id: user?.id ?? null,
      tipo: form.tipo,
      fecha: new Date(form.fecha).toISOString(),
      resultado: form.resultado || null,
      compromiso: form.compromiso || null,
      proxima_accion_fecha: form.proxima_accion_fecha || null,
      proxima_accion_nota: form.proxima_accion_nota || null,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo registrar: " + error.message);
    toast.success("Interacción registrada");
    setForm({ ...empty, fecha: new Date().toISOString().slice(0, 16) });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta interacción?")) return;
    const { error } = await supabase.from("seguimientos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar interacción</CardTitle>
          <CardDescription>Anota llamadas, visitas o mensajes para no perder el hilo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((s) => ({ ...s, tipo: v as TipoInter }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_META) as TipoInter[]).map((k) => (
                    <SelectItem key={k} value={k}>{TIPO_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input type="datetime-local" value={form.fecha}
                onChange={(e) => setForm((s) => ({ ...s, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Resultado / comentarios *</Label>
            <Textarea rows={2} value={form.resultado}
              onChange={(e) => setForm((s) => ({ ...s, resultado: e.target.value }))}
              placeholder="Ej: Presenté propuesta. Pidió detalle de tarifas para Lima Sur." />
          </div>
          <div>
            <Label className="text-xs">Compromiso</Label>
            <Input value={form.compromiso}
              onChange={(e) => setForm((s) => ({ ...s, compromiso: e.target.value }))}
              placeholder="Ej: Enviar cotización el jueves" />
          </div>
          <div className="grid md:grid-cols-[180px_1fr] gap-3">
            <div>
              <Label className="text-xs">Próxima acción</Label>
              <Input type="date" value={form.proxima_accion_fecha}
                onChange={(e) => setForm((s) => ({ ...s, proxima_accion_fecha: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Nota de la próxima acción</Label>
              <Input value={form.proxima_accion_nota}
                onChange={(e) => setForm((s) => ({ ...s, proxima_accion_nota: e.target.value }))}
                placeholder="Ej: Llamar para confirmar recepción" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
          <CardDescription>{items.length} interacción{items.length === 1 ? "" : "es"} registrada{items.length === 1 ? "" : "s"}.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no hay interacciones. Registra la primera arriba.</p>
          ) : (
            <div className="space-y-3">
              {items.map((s) => {
                const meta = TIPO_META[s.tipo];
                const Icon = meta.icon;
                return (
                  <div key={s.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{meta.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.fecha).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </div>
                        {s.resultado && <p className="text-sm mt-1 whitespace-pre-wrap">{s.resultado}</p>}
                        {s.compromiso && (
                          <p className="text-xs mt-1"><span className="text-muted-foreground">Compromiso:</span> {s.compromiso}</p>
                        )}
                        {s.proxima_accion_fecha && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs">
                            <CalendarClock className="h-3.5 w-3.5 text-primary" />
                            <Badge variant="outline" className="font-normal">
                              Próx: {new Date(s.proxima_accion_fecha).toLocaleDateString("es-PE")}
                              {s.proxima_accion_nota ? ` — ${s.proxima_accion_nota}` : ""}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}