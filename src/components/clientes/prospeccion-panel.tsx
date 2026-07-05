import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, Target } from "lucide-react";

const FUENTES = [
  { value: "referido", label: "Referido" },
  { value: "web", label: "Web / Formulario" },
  { value: "cold_call", label: "Llamada en frío" },
  { value: "feria", label: "Feria / Evento" },
  { value: "campaña", label: "Campaña marketing" },
  { value: "otro", label: "Otro" },
];

type Row = {
  fuente_prospeccion: string | null;
  probabilidad_cierre: number;
  valor_estimado_mensual: number | null;
  proximo_contacto_en: string | null;
  ultimo_contacto_en: string | null;
};

export function ProspeccionPanel({ clienteId }: { clienteId: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .from("clientes")
      .select("fuente_prospeccion, probabilidad_cierre, valor_estimado_mensual, proximo_contacto_en, ultimo_contacto_en")
      .eq("id", clienteId)
      .maybeSingle()
      .then(({ data }) => setRow((data as Row) ?? {
        fuente_prospeccion: null, probabilidad_cierre: 0,
        valor_estimado_mensual: null, proximo_contacto_en: null, ultimo_contacto_en: null,
      }));
  }, [clienteId]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("clientes").update({
      fuente_prospeccion: row.fuente_prospeccion,
      probabilidad_cierre: Number(row.probabilidad_cierre) || 0,
      valor_estimado_mensual: row.valor_estimado_mensual,
      proximo_contacto_en: row.proximo_contacto_en,
      ultimo_contacto_en: row.ultimo_contacto_en,
    }).eq("id", clienteId);
    setSaving(false);
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
    toast.success("Datos de prospección guardados");
  };

  if (!row) {
    return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-4 w-4 text-primary" /> Prospección
        </CardTitle>
        <CardDescription>Información del embudo comercial. Se usa en el Kanban de Prospección y en el pipeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fuente">Fuente del prospecto</Label>
            <Select
              value={row.fuente_prospeccion ?? "__none__"}
              onValueChange={(v) => setRow({ ...row, fuente_prospeccion: v === "__none__" ? null : v })}
            >
              <SelectTrigger id="fuente"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin especificar</SelectItem>
                {FUENTES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="valor">Valor estimado mensual (S/)</Label>
            <Input
              id="valor" type="number" min={0} step="0.01"
              value={row.valor_estimado_mensual ?? ""}
              onChange={(e) => setRow({ ...row, valor_estimado_mensual: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="prob">Probabilidad de cierre (%)</Label>
            <Input
              id="prob" type="number" min={0} max={100} step={5}
              value={row.probabilidad_cierre}
              onChange={(e) => setRow({ ...row, probabilidad_cierre: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            />
          </div>
          <div>
            <Label htmlFor="proximo">Próximo contacto</Label>
            <Input
              id="proximo" type="date"
              value={row.proximo_contacto_en ?? ""}
              onChange={(e) => setRow({ ...row, proximo_contacto_en: e.target.value || null })}
            />
          </div>
          <div>
            <Label htmlFor="ultimo">Último contacto</Label>
            <Input
              id="ultimo" type="date"
              value={row.ultimo_contacto_en ?? ""}
              onChange={(e) => setRow({ ...row, ultimo_contacto_en: e.target.value || null })}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}