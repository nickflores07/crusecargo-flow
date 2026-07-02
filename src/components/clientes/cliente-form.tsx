import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, User as UserIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClienteFormValues = {
  tipo: "empresa" | "persona";
  razon_social: string;
  ruc: string;
  rubro: string;
  nombre_completo: string;
  dni: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  correo: string;
  estado: "prospecto" | "activo" | "inactivo" | "perdido";
  notas: string;
};

export const emptyCliente: ClienteFormValues = {
  tipo: "empresa",
  razon_social: "",
  ruc: "",
  rubro: "",
  nombre_completo: "",
  dni: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  correo: "",
  estado: "prospecto",
  notas: "",
};

export function ClienteForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  submitLabel = "Guardar cliente",
  lockTipo = false,
}: {
  initial?: Partial<ClienteFormValues>;
  submitting?: boolean;
  onSubmit: (values: ClienteFormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  lockTipo?: boolean;
}) {
  const [values, setValues] = useState<ClienteFormValues>({ ...emptyCliente, ...initial });
  const set = <K extends keyof ClienteFormValues>(k: K, v: ClienteFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(values);
  };

  const isEmpresa = values.tipo === "empresa";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!lockTipo && (
        <div>
          <Label className="mb-2 block">Tipo de cliente</Label>
          <div className="grid grid-cols-2 gap-3">
            {(["empresa", "persona"] as const).map((t) => {
              const active = values.tipo === t;
              const Icon = t === "empresa" ? Building2 : UserIcon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("tipo", t)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="font-medium capitalize">{t === "empresa" ? "Empresa (B2B)" : "Persona (B2C)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t === "empresa" ? "Envíos recurrentes" : "Envíos ocasionales"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isEmpresa ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="razon_social">Razón social *</Label>
            <Input id="razon_social" required value={values.razon_social}
              onChange={(e) => set("razon_social", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ruc">RUC</Label>
            <Input id="ruc" value={values.ruc} onChange={(e) => set("ruc", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rubro">Rubro / Industria</Label>
            <Input id="rubro" value={values.rubro} onChange={(e) => set("rubro", e.target.value)}
              placeholder="Ej: Retail, E-commerce, Farmacia..." />
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nombre_completo">Nombre completo *</Label>
            <Input id="nombre_completo" required value={values.nombre_completo}
              onChange={(e) => set("nombre_completo", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dni">DNI</Label>
            <Input id="dni" value={values.dni} onChange={(e) => set("dni", e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" value={values.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="correo">Correo</Label>
          <Input id="correo" type="email" value={values.correo}
            onChange={(e) => set("correo", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="direccion">Dirección</Label>
          <Input id="direccion" value={values.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ciudad">Ciudad</Label>
          <Input id="ciudad" value={values.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Select value={values.estado} onValueChange={(v) => set("estado", v as ClienteFormValues["estado"])}>
            <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="prospecto">Prospecto</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="perdido">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notas">Notas</Label>
        <Textarea id="notas" rows={3} value={values.notas}
          onChange={(e) => set("notas", e.target.value)}
          placeholder="Cualquier detalle útil sobre este cliente" />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}