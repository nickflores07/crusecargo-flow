import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Truck, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, roles, isAdmin } = useAuth();
  const nombre = (user?.user_metadata?.nombre as string) || user?.email?.split("@")[0] || "";
  const rolLabel = roles[0] ?? "sin rol";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <p className="text-sm text-muted-foreground capitalize">{rolLabel}</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">¡Hola, {nombre}! 👋</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido al CRM de Cruz del Sur Cargo. Aquí verás tus indicadores comerciales cada día.
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Estamos construyendo tu CRM por etapas</CardTitle>
              <CardDescription className="mt-1">
                Ya está lista la <b>Etapa 1</b>: inicio de sesión y control de accesos por rol.
                {isAdmin && " Como administrador, puedes gestionar usuarios desde el menú lateral."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <p className="font-medium">Próximas etapas:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li><b className="text-foreground">Etapa 2:</b> Clientes (crear/editar) + importar Excel</li>
              <li>Contactos, seguimiento comercial y oportunidades</li>
              <li>Historial de envíos y cotizaciones</li>
              <li>Dashboard con indicadores y gráficos</li>
              <li>Agenda, alertas automáticas y buscador rápido</li>
              <li>Asistente de IA</li>
              <li>Configuración final y ajustes de diseño</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Vista previa del panel comercial</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Clientes", icon: Users, value: "—" },
            { label: "Oportunidades", icon: Target, value: "—" },
            { label: "Envíos del mes", icon: Truck, value: "—" },
            { label: "Ventas del mes", icon: TrendingUp, value: "—" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Se activa en la Etapa 2</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Prepara tu equipo</CardTitle>
            <CardDescription>
              Invita a los ejecutivos y supervisores para que puedan empezar a usar el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/admin/usuarios">
                Gestionar usuarios <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
