import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const TIPOS = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "correo", label: "Correo" },
  { value: "reunion", label: "Reunión" },
  { value: "visita", label: "Visita" },
  { value: "otro", label: "Otro" },
] as const;

// Cadencia sugerida en días por estado del cliente.
const CADENCIA: Record<string, number> = {
  prospecto: 3,
  en_negociacion: 2,
  activo: 15,
  inactivo: 30,
  perdido: 60,
};

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function RegistrarContactoDialog({
  clienteId,
  clienteNombre,
  estadoCliente,
  open,
  onOpenChange,
  onSaved,
}: {
  clienteId: string;
  clienteNombre: string;
  estadoCliente: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["value"]>("llamada");
  const [resultado, setResultado] = useState("");
  const [proximaFecha, setProximaFecha] = useState<string>(
    addDays(new Date(), CADENCIA[estadoCliente ?? "prospecto"] ?? 3)
  );
  const [proximaNota, setProximaNota] = useState("");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!resultado.trim()) {
      toast.error("Cuéntanos brevemente el resultado del contacto");
      return;
    }
    setSaving(true);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const { error: e1 } = await supabase.from("seguimientos").insert({
      cliente_id: clienteId,
      usuario_id: user?.id ?? null,
      tipo,
      fecha: new Date().toISOString(),
      resultado,
      proxima_accion_fecha: proximaFecha || null,
      proxima_accion_nota: proximaNota || null,
    });
    if (e1) {
      setSaving(false);
      toast.error("No se pudo registrar el contacto: " + e1.message);
      return;
    }
    const { error: e2 } = await supabase.from("clientes").update({
      ultimo_contacto_en: hoyIso,
      proximo_contacto_en: proximaFecha || null,
    }).eq("id", clienteId);
    setSaving(false);
    if (e2) {
      toast.error("Se guardó el seguimiento, pero no la fecha de próximo contacto: " + e2.message);
    } else {
      toast.success("Contacto registrado");
    }
    onOpenChange(false);
    setResultado("");
    setProximaNota("");
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar contacto</DialogTitle>
          <DialogDescription>{clienteNombre}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="resultado">Resultado / notas</Label>
            <Textarea
              id="resultado" rows={3}
              value={resultado} onChange={(e) => setResultado(e.target.value)}
              placeholder="¿De qué hablaron? ¿Qué quedó pendiente?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proxima">Próximo contacto</Label>
              <Input
                id="proxima" type="date"
                value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Sugerido según estado: {CADENCIA[estadoCliente ?? "prospecto"] ?? 3}d
              </p>
            </div>
            <div>
              <Label htmlFor="proxima-nota">Recordatorio</Label>
              <Input
                id="proxima-nota" value={proximaNota}
                onChange={(e) => setProximaNota(e.target.value)}
                placeholder="Enviar cotización..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void guardar()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}