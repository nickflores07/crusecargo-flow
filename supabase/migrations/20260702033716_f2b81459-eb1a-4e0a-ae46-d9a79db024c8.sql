
-- ============ CLIENTES ============
CREATE TYPE public.tipo_cliente AS ENUM ('empresa', 'persona');
CREATE TYPE public.estado_cliente AS ENUM ('prospecto', 'activo', 'inactivo', 'perdido');

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_cliente NOT NULL,
  -- Empresa
  razon_social text,
  ruc text,
  rubro text,
  -- Persona
  nombre_completo text,
  dni text,
  -- Comunes
  direccion text,
  ciudad text,
  telefono text,
  correo text,
  estado public.estado_cliente NOT NULL DEFAULT 'prospecto',
  ejecutivo_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_alta date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clientes_ejecutivo ON public.clientes(ejecutivo_id);
CREATE INDEX idx_clientes_tipo ON public.clientes(tipo);
CREATE INDEX idx_clientes_ruc ON public.clientes(ruc) WHERE ruc IS NOT NULL;
CREATE INDEX idx_clientes_dni ON public.clientes(dni) WHERE dni IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver clientes segun rol" ON public.clientes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador') OR
  public.has_role(auth.uid(), 'supervisor') OR
  ejecutivo_id = auth.uid()
);

CREATE POLICY "Insertar clientes autenticado" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'administrador') OR
  public.has_role(auth.uid(), 'supervisor') OR
  ejecutivo_id = auth.uid()
);

CREATE POLICY "Editar clientes segun rol" ON public.clientes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'administrador') OR
  public.has_role(auth.uid(), 'supervisor') OR
  ejecutivo_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrador') OR
  public.has_role(auth.uid(), 'supervisor') OR
  ejecutivo_id = auth.uid()
);

CREATE POLICY "Solo admin elimina clientes" ON public.clientes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER trg_clientes_updated
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DATOS COMERCIALES ============
CREATE TABLE public.datos_comerciales_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  volumen_envios_mes integer,
  peso_promedio_kg numeric(10,2),
  zonas_frecuentes text,
  tipo_paquete text,
  frecuencia_envio text,
  tarifa_negociada numeric(10,2),
  contrato boolean NOT NULL DEFAULT false,
  facturacion_mensual_estimada numeric(12,2),
  pct_entregas_a_tiempo numeric(5,2),
  pct_devoluciones numeric(5,2),
  competidor_actual text,
  observaciones text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.datos_comerciales_cliente TO authenticated;
GRANT ALL ON public.datos_comerciales_cliente TO service_role;
ALTER TABLE public.datos_comerciales_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Datos comerciales heredan cliente" ON public.datos_comerciales_cliente FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)))
WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)));

CREATE TRIGGER trg_datos_comerciales_updated
BEFORE UPDATE ON public.datos_comerciales_cliente
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CONTACTOS ============
CREATE TABLE public.contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  cargo text,
  celular text,
  correo text,
  cumpleanos date,
  notas text,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contactos_cliente ON public.contactos(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contactos TO authenticated;
GRANT ALL ON public.contactos TO service_role;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contactos heredan cliente" ON public.contactos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)))
WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)));

CREATE TRIGGER trg_contactos_updated
BEFORE UPDATE ON public.contactos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DIRECCIONES ============
CREATE TABLE public.direcciones_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  etiqueta text,
  direccion text NOT NULL,
  ciudad text,
  referencia text,
  es_principal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_direcciones_cliente ON public.direcciones_entrega(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direcciones_entrega TO authenticated;
GRANT ALL ON public.direcciones_entrega TO service_role;
ALTER TABLE public.direcciones_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Direcciones heredan cliente" ON public.direcciones_entrega FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)))
WITH CHECK (EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = cliente_id AND (
  public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor') OR c.ejecutivo_id = auth.uid()
)));

CREATE TRIGGER trg_direcciones_updated
BEFORE UPDATE ON public.direcciones_entrega
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ IMPORTACIONES ============
CREATE TABLE public.importaciones_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archivo_nombre text,
  total integer NOT NULL DEFAULT 0,
  creados integer NOT NULL DEFAULT 0,
  actualizados integer NOT NULL DEFAULT 0,
  errores integer NOT NULL DEFAULT 0,
  log jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_importaciones_user ON public.importaciones_clientes(user_id);

GRANT SELECT, INSERT ON public.importaciones_clientes TO authenticated;
GRANT ALL ON public.importaciones_clientes TO service_role;
ALTER TABLE public.importaciones_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mis importaciones o admin" ON public.importaciones_clientes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Insertar mis importaciones" ON public.importaciones_clientes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
