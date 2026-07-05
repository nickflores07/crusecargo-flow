import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface ModuloVisible {
  modulo_id: string;
  nombre: string;
  icono: string | null;
  ruta: string;
  grupo: string;
  orden: number;
}

interface ModulosContextValue {
  modulos: ModuloVisible[];
  loading: boolean;
  isRutaVisible: (pathname: string) => boolean;
  moduloDeRuta: (pathname: string) => ModuloVisible | undefined;
  refresh: () => Promise<void>;
}

const ModulosContext = createContext<ModulosContextValue | undefined>(undefined);

// Definición estática de módulos conocidos (fallback + para el guard cuando la BD aún no responde)
const RUTAS_MODULOS: Array<{ id: string; ruta: string }> = [
  { id: "inicio", ruta: "/" },
  { id: "clientes", ruta: "/clientes" },
  { id: "oportunidades", ruta: "/oportunidades" },
  { id: "cotizaciones", ruta: "/cotizaciones" },
  { id: "tarifario", ruta: "/tarifario" },
  { id: "envios", ruta: "/envios" },
  { id: "agenda", ruta: "/agenda" },
  { id: "asistente", ruta: "/asistente" },
  { id: "configuracion", ruta: "/configuracion" },
  { id: "admin_usuarios", ruta: "/admin/usuarios" },
  { id: "admin_sectores", ruta: "/admin/sectores" },
  { id: "admin_permisos", ruta: "/admin/permisos" },
];

function matchRuta(ruta: string, pathname: string): boolean {
  if (ruta === "/") return pathname === "/";
  return pathname === ruta || pathname.startsWith(ruta + "/");
}

export function ModulosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [modulos, setModulos] = useState<ModuloVisible[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!user) {
      setModulos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("mis_modulos_visibles");
    if (!error && data) setModulos(data as ModuloVisible[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const moduloDeRuta = useCallback(
    (pathname: string) => {
      // preferir la ruta más específica (más larga) que coincida
      const candidatos = RUTAS_MODULOS.filter((r) => matchRuta(r.ruta, pathname))
        .sort((a, b) => b.ruta.length - a.ruta.length);
      const primero = candidatos[0];
      if (!primero) return undefined;
      return modulos.find((m) => m.modulo_id === primero.id);
    },
    [modulos],
  );

  const isRutaVisible = useCallback(
    (pathname: string) => {
      // si la ruta no está registrada como módulo, permitir (rutas hijas ad-hoc)
      const candidatos = RUTAS_MODULOS.filter((r) => matchRuta(r.ruta, pathname))
        .sort((a, b) => b.ruta.length - a.ruta.length);
      const primero = candidatos[0];
      if (!primero) return true;
      return modulos.some((m) => m.modulo_id === primero.id);
    },
    [modulos],
  );

  return (
    <ModulosContext.Provider value={{ modulos, loading, isRutaVisible, moduloDeRuta, refresh: cargar }}>
      {children}
    </ModulosContext.Provider>
  );
}

export function useModulos() {
  const ctx = useContext(ModulosContext);
  if (!ctx) throw new Error("useModulos debe usarse dentro de <ModulosProvider>");
  return ctx;
}