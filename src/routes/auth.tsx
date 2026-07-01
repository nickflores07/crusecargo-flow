import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Correo inválido").max(255);
const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(72);
const nombreSchema = z.string().trim().min(2, "Escribe tu nombre").max(80);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const parsed = z.object({ email: emailSchema, password: z.string().min(1, "Ingresa tu contraseña") }).safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) return toast.error("No pudimos iniciar sesión: " + error.message);
    toast.success("¡Bienvenido!");
    navigate({ to: "/" });
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const nombre = String(form.get("nombre") ?? "");
    const parsed = z.object({ email: emailSchema, password: passwordSchema, nombre: nombreSchema }).safeParse({ email, password, nombre });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre: parsed.data.nombre },
      },
    });
    setBusy(false);
    if (error) return toast.error("No pudimos crear la cuenta: " + error.message);
    toast.success("Cuenta creada. ¡Bienvenido!");
    navigate({ to: "/" });
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) return toast.error("Google: " + result.error.message);
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Cruz del Sur Cargo</h1>
            <p className="text-xs text-muted-foreground">CRM Comercial</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>Ingresa a tu cuenta o crea una nueva.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="l-email">Correo</Label>
                    <Input id="l-email" name="email" type="email" placeholder="tu@correo.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="l-pass">Contraseña</Label>
                    <Input id="l-pass" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="s-nombre">Nombre completo</Label>
                    <Input id="s-nombre" name="nombre" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-email">Correo</Label>
                    <Input id="s-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s-pass">Contraseña</Label>
                    <Input id="s-pass" name="password" type="password" minLength={8} required />
                    <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Crear cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o continúa con</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy} type="button">
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              Continuar con Google
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Al continuar aceptas el uso interno del sistema CRM de Cruz del Sur Cargo.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:underline">Volver al inicio</Link>
        </p>
      </div>
    </div>
  );
}