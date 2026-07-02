
-- 1) Nuevo estado "en_negociacion"
ALTER TYPE public.estado_cliente ADD VALUE IF NOT EXISTS 'en_negociacion' BEFORE 'activo';

-- 2) Enums para seguimientos y oportunidades
DO $$ BEGIN
  CREATE TYPE public.tipo_interaccion AS ENUM ('llamada','visita','reunion','whatsapp','correo','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_oportunidad AS ENUM ('en_proceso','ganada','perdida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Tabla seguimientos
CREATE TABLE IF NOT EXISTS public.seguimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo public.tipo_interaccion NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  resultado text,
  compromiso text,
  proxima_accion_fecha date,
  proxima_accion_nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente ON public.seguimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_proxima ON public.seguimientos(proxima_accion_fecha) WHERE proxima_accion_fecha IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguimientos TO authenticated;
GRANT ALL ON public.seguimientos TO service_role;

ALTER TABLE public.seguimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seguimientos heredan cliente" ON public.seguimientos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = seguimientos.cliente_id
      AND (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor') OR c.ejecutivo_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = seguimientos.cliente_id
      AND (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor') OR c.ejecutivo_id = auth.uid())
  ));

CREATE TRIGGER trg_seguimientos_updated
  BEFORE UPDATE ON public.seguimientos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Tabla oportunidades
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ejecutivo_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  servicio text,
  monto_potencial numeric(12,2),
  probabilidad int NOT NULL DEFAULT 50,
  fecha_cierre_estimada date,
  estado public.estado_oportunidad NOT NULL DEFAULT 'en_proceso',
  motivo_perdida text,
  notas text,
  orden int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente ON public.oportunidades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_estado ON public.oportunidades(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Oportunidades heredan cliente" ON public.oportunidades
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = oportunidades.cliente_id
      AND (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor') OR c.ejecutivo_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = oportunidades.cliente_id
      AND (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor') OR c.ejecutivo_id = auth.uid())
  ));

CREATE TRIGGER trg_oportunidades_updated
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Validación: motivo obligatorio si se marca "perdida"
CREATE OR REPLACE FUNCTION public.validar_oportunidad_perdida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'perdida' AND (NEW.motivo_perdida IS NULL OR btrim(NEW.motivo_perdida) = '') THEN
    RAISE EXCEPTION 'Debes indicar el motivo de pérdida al marcar la oportunidad como Perdida';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_oportunidad_perdida
  BEFORE INSERT OR UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.validar_oportunidad_perdida();
