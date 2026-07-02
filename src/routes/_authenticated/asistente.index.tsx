import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/asistente/")({
  component: () => (
    <div className="h-full grid place-items-center p-8 text-center">
      <div className="max-w-md space-y-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center mx-auto">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold">Tu asistente comercial</h2>
        <p className="text-sm text-muted-foreground">
          Puede resumir clientes, mostrar KPIs, redactar correos o WhatsApp de seguimiento, y proponer crear
          seguimientos u oportunidades para que tú apruebes.
        </p>
        <p className="text-xs text-muted-foreground">
          Comienza dando clic en <b>Nueva conversación</b>.
        </p>
      </div>
    </div>
  ),
});