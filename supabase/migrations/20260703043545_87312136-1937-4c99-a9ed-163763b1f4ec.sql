
-- =========================================================
-- 1. TARIFAS
-- =========================================================
CREATE TABLE public.tarifas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origen TEXT NOT NULL,
  destino TEXT NOT NULL,
  servicio TEXT NOT NULL DEFAULT 'encomienda',
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  precio_por_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  peso_minimo_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta DATE,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarifas_ruta ON public.tarifas (lower(origen), lower(destino), servicio) WHERE activo;
CREATE INDEX idx_tarifas_cliente ON public.tarifas (cliente_id) WHERE activo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas TO authenticated;
GRANT ALL ON public.tarifas TO service_role;

ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leen tarifas activas"
  ON public.tarifas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin y supervisor gestionan tarifas"
  ON public.tarifas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador') OR public.has_role(auth.uid(), 'supervisor'));

CREATE TRIGGER trg_tarifas_updated_at
  BEFORE UPDATE ON public.tarifas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. COTIZACIONES - nuevos campos
-- =========================================================
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS correo_destino TEXT,
  ADD COLUMN IF NOT EXISTS correos_cc TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS condiciones TEXT,
  ADD COLUMN IF NOT EXISTS notas_internas TEXT,
  ADD COLUMN IF NOT EXISTS incluye_igv BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enviada_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviada_a TEXT,
  ADD COLUMN IF NOT EXISTS token_publico TEXT UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_oportunidad ON public.cotizaciones(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_token ON public.cotizaciones(token_publico);

-- =========================================================
-- 3. COTIZACION_ITEMS - nuevos campos
-- =========================================================
ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS origen TEXT,
  ADD COLUMN IF NOT EXISTS destino TEXT,
  ADD COLUMN IF NOT EXISTS servicio TEXT,
  ADD COLUMN IF NOT EXISTS peso_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS bultos INTEGER,
  ADD COLUMN IF NOT EXISTS precio_sugerido NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tarifa_id UUID REFERENCES public.tarifas(id) ON DELETE SET NULL;

-- =========================================================
-- 4. ENVIOS - nuevos campos + nuevo estado
-- =========================================================
ALTER TYPE public.envio_estado ADD VALUE IF NOT EXISTS 'estimado' BEFORE 'en_transito';

ALTER TABLE public.envios
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen_registro TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_envios_cotizacion ON public.envios(cotizacion_id);

-- =========================================================
-- 5. SECUENCIA + FUNCION correlativo
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.cotizacion_correlativo_seq START 1;
REVOKE ALL ON SEQUENCE public.cotizacion_correlativo_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.cotizacion_correlativo_seq TO service_role;

CREATE OR REPLACE FUNCTION public.siguiente_numero_cotizacion()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.cotizacion_correlativo_seq');
  RETURN 'COT-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.siguiente_numero_cotizacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siguiente_numero_cotizacion() TO authenticated;

-- =========================================================
-- 6. RPC sugerir_tarifa
-- =========================================================
CREATE OR REPLACE FUNCTION public.sugerir_tarifa(
  _cliente_id UUID,
  _origen TEXT,
  _destino TEXT,
  _servicio TEXT,
  _peso_kg NUMERIC
)
RETURNS TABLE (
  tarifa_id UUID,
  precio_sugerido NUMERIC,
  origen_tarifa TEXT,
  precio_por_kg NUMERIC,
  precio_minimo NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  _origin TEXT;
BEGIN
  -- 1) tarifa cliente específica
  SELECT * INTO t FROM public.tarifas
  WHERE activo
    AND cliente_id = _cliente_id
    AND lower(origen) = lower(_origen)
    AND lower(destino) = lower(_destino)
    AND servicio = _servicio
    AND vigente_desde <= CURRENT_DATE
    AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
  ORDER BY vigente_desde DESC LIMIT 1;

  IF FOUND THEN
    _origin := 'cliente';
  ELSE
    -- 2) tarifa general
    SELECT * INTO t FROM public.tarifas
    WHERE activo
      AND cliente_id IS NULL
      AND lower(origen) = lower(_origen)
      AND lower(destino) = lower(_destino)
      AND servicio = _servicio
      AND vigente_desde <= CURRENT_DATE
      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
    ORDER BY vigente_desde DESC LIMIT 1;

    IF FOUND THEN
      _origin := 'general';
    ELSE
      RETURN QUERY SELECT NULL::uuid, NULL::numeric, 'sin_tarifa'::text, NULL::numeric, NULL::numeric;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY SELECT
    t.id,
    GREATEST(COALESCE(_peso_kg,0) * t.precio_por_kg, t.precio_minimo)::numeric,
    _origin,
    t.precio_por_kg,
    t.precio_minimo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sugerir_tarifa(uuid,text,text,text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sugerir_tarifa(uuid,text,text,text,numeric) TO authenticated;
