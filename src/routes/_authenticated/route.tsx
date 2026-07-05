import { createFileRoute, Outlet, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Loader2, ShieldOff } from "lucide-react";
import { ModulosProvider, useModulos } from "@/hooks/use-modulos";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ModulosProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AppHeader />
            <main className="flex-1 p-4 md:p-6 max-w-full">
              <ModuloGuard>
                <Outlet />
              </ModuloGuard>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ModulosProvider>
  );
}

function ModuloGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { isRutaVisible, loading } = useModulos();
  if (loading) return <>{children}</>;
  if (isRutaVisible(pathname)) return <>{children}</>;
  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted grid place-items-center">
          <ShieldOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl font-semibold">Sin acceso a este módulo</h2>
        <p className="text-sm text-muted-foreground">
          Tu rol actual no tiene permiso para ver esta sección. Si crees que es un error, contacta a un administrador.
        </p>
        <Link to="/"><Button variant="outline" size="sm">Volver al inicio</Button></Link>
      </div>
    </div>
  );
}
