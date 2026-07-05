import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Phone, Handshake, Video, MessageCircle, MoreHorizontal, Loader2 } from "lucide-react";

const TIPOS = [
  { value: "visita", label: "Visita presencial", icon: Building2 },
  { value: "reunion", label: "Reunión presencial", icon: Handshake },
  { value: "reunion_teams", label: "Reunión Teams", icon: Video },
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "otro", label: "Otro", icon: MoreHorizontal },
] as const;

function ymdToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ProgramarActividadDialog({
  open, onOpenChange, oportunidadId, clienteId, ejecutivoId, clienteNombre, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  oportunidadId: string;
  clienteId: string;
  ejecutivoId: string;
  clienteNombre: string;
  onSaved?: () => void;
}) {
  const [tipo, setTipo] = useState<string>("visita");
  const [fecha, setFecha] = useState<string>(ymdToday());
  const [hora, setHora] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [detalles, setDetalles] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo("visita");
      setFecha(ymdToday());
      setHora("");
      setMotivo("");
      setDetalles("");
    }
  }, [open]);

  const guardar = async () => {
    if (!fecha) return toast.error("Elige una fecha");
    if (!ejecutivoId) return toast.error("No se identificó al ejecutivo");
    setSaving(true);
    const { error } = await supabase.from("visitas_planificadas").insert({
      cliente_id: clienteId,
      ejecutivo_id: ejecutivoId,
      oportunidad_id: oportunidadId,
      fecha_planificada: fecha,
      hora: hora || null,
      tipo,
      motivo: motivo || null,
      detalles: detalles || null,
    });
    if (!error) {
      // Actualiza el "próximo contacto" del cliente para que Mi Día lo vea
      await supabase.from("clientes")
        .update({ proximo_contacto_en: fecha })
        .eq("id", clienteId);
    }
    setSaving(false);
    if (error) return toast.error("No se pudo agendar: " + error.message);
    toast.success("Actividad programada");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar actividad</DialogTitle>
          <DialogDescription>
            Para <b>{clienteNombre}</b>. Se agenda en Plan Semanal y aparece en Mi Día.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {TIPOS.map((t) => {
              const I = t.icon;
              const active = tipo === t.value;
              return (
                <button key={t.value} type="button" onClick={() => setTipo(t.value)}
                  className={`rounded-md border p-2 text-[11px] flex flex-col items-center gap-1 transition ${active ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted/50"}`}>
                  <I className="h-4 w-4" />
                  <span className="leading-tight text-center">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha *</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hora</Label>
              <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo / objetivo</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Presentar propuesta, cierre de tarifa…" />
          </div>

          <div>
            <Label className="text-xs">Detalles</Label>
            <Textarea rows={2} value={detalles} onChange={(e) => setDetalles(e.target.value)}
              placeholder="Contacto, dirección, link de Teams…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={guardar} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Programar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}