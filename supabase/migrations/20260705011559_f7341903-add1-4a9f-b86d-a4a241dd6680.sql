
-- Fase 1: Sistema de permisos por módulo

CREATE TABLE public.modulos_app (
  id text PRIMARY KEY,
  nombre text NOT NULL,
  icono text,
  ruta text NOT NULL,
  grupo text NOT NULL DEFAULT 'menu',
  orden int NOT NULL DEFAULT 0,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.modulos_app TO authenticated;
GRANT ALL ON public.modulos_app TO service_role;

ALTER TABLE public.modulos_app ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados pueden ver módulos"
  ON public.modulos_app FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores gestionan módulos"
  ON public.modulos_app FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER trg_modulos_app_updated BEFORE UPDATE ON public.modulos_app
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permisos por rol
CREATE TABLE public.permisos_modulos_rol (
  rol public.app_role NOT NULL,
  modulo_id text NOT NULL REFERENCES public.modulos_app(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol, modulo_id)
);

GRANT SELECT ON public.permisos_modulos_rol TO authenticated;
GRANT ALL ON public.permisos_modulos_rol TO service_role;

ALTER TABLE public.permisos_modulos_rol ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leen permisos de rol"
  ON public.permisos_modulos_rol FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo administradores editan permisos de rol"
  ON public.permisos_modulos_rol FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER trg_permisos_rol_updated BEFORE UPDATE ON public.permisos_modulos_rol
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Excepciones por usuario
CREATE TABLE public.permisos_modulos_usuario (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo_id text NOT NULL REFERENCES public.modulos_app(id) ON DELETE CASCADE,
  visible boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, modulo_id)
);

GRANT SELECT ON public.permisos_modulos_usuario TO authenticated;
GRANT ALL ON public.permisos_modulos_usuario TO service_role;

ALTER TABLE public.permisos_modulos_usuario ENABLE ROW LEVEL SECURITY;

-- El usuario puede ver sus propios overrides; admin ve todo
CREATE POLICY "Usuario lee sus overrides o admin todos"
  ON public.permisos_modulos_usuario FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Solo administradores editan overrides"
  ON public.permisos_modulos_usuario FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER trg_permisos_usuario_updated BEFORE UPDATE ON public.permisos_modulos_usuario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Función que resuelve permisos efectivos del usuario logueado
CREATE OR REPLACE FUNCTION public.mis_modulos_visibles()
RETURNS TABLE (
  modulo_id text, nombre text, icono text, ruta text, grupo text, orden int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mis_roles AS (
    SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ),
  visibilidad AS (
    SELECT
      m.id AS modulo_id, m.nombre, m.icono, m.ruta, m.grupo, m.orden,
      COALESCE(
        -- Override individual
        (SELECT visible FROM public.permisos_modulos_usuario u
          WHERE u.user_id = auth.uid() AND u.modulo_id = m.id LIMIT 1),
        -- Permiso por rol: TRUE si algún rol del usuario lo tiene visible
        (SELECT bool_or(pr.visible) FROM public.permisos_modulos_rol pr
          WHERE pr.rol IN (SELECT role FROM mis_roles) AND pr.modulo_id = m.id),
        -- Por defecto visible
        true
      ) AS visible
    FROM public.modulos_app m
  )
  SELECT modulo_id, nombre, icono, ruta, grupo, orden
  FROM visibilidad
  WHERE visible = true
  ORDER BY grupo, orden, nombre;
$$;

GRANT EXECUTE ON FUNCTION public.mis_modulos_visibles() TO authenticated;

-- Seed inicial de módulos actuales
INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden) VALUES
  ('inicio',         'Inicio',            'LayoutDashboard', '/',                 'menu',  10),
  ('clientes',       'Clientes',          'Users',           '/clientes',         'menu',  20),
  ('oportunidades',  'Oportunidades',     'Target',          '/oportunidades',    'menu',  30),
  ('cotizaciones',   'Cotizaciones',      'FileText',        '/cotizaciones',     'menu',  40),
  ('tarifario',      'Tarifario',         'Tags',            '/tarifario',        'menu',  50),
  ('envios',         'Envíos',            'Truck',           '/envios',           'menu',  60),
  ('agenda',         'Agenda',            'Calendar',        '/agenda',           'menu',  70),
  ('asistente',      'Asistente IA',      'Sparkles',        '/asistente',       'menu',  80),
  ('configuracion',  'Configuración',     'Settings',        '/configuracion',    'menu',  90),
  ('admin_usuarios', 'Usuarios y roles',  'UserCog',         '/admin/usuarios',   'admin', 10),
  ('admin_sectores', 'Sectores',          'Tags',            '/admin/sectores',   'admin', 20),
  ('admin_permisos', 'Módulos y permisos','ShieldCheck',     '/admin/permisos',   'admin', 30);

-- Permisos por rol por defecto
-- Administrador: todo
INSERT INTO public.permisos_modulos_rol (rol, modulo_id, visible)
SELECT 'administrador'::public.app_role, id, true FROM public.modulos_app;

-- Supervisor: menú completo, admin excepto permisos y usuarios (solo admin)
INSERT INTO public.permisos_modulos_rol (rol, modulo_id, visible)
SELECT 'supervisor'::public.app_role, id, CASE WHEN grupo = 'admin' AND id IN ('admin_usuarios','admin_permisos') THEN false ELSE true END
FROM public.modulos_app;

-- Ejecutivo: menú operativo, sin admin ni tarifario/configuración
INSERT INTO public.permisos_modulos_rol (rol, modulo_id, visible)
SELECT 'ejecutivo'::public.app_role, id,
  CASE WHEN grupo = 'admin' THEN false
       WHEN id IN ('tarifario','configuracion') THEN false
       ELSE true END
FROM public.modulos_app;
