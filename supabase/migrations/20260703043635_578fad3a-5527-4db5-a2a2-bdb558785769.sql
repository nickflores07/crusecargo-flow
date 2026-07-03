
-- sugerir_tarifa: no necesita SECURITY DEFINER, RLS permite SELECT a authenticated
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
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  _origin TEXT;
BEGIN
  SELECT * INTO t FROM public.tarifas
  WHERE activo AND cliente_id = _cliente_id
    AND lower(origen)=lower(_origen) AND lower(destino)=lower(_destino) AND servicio=_servicio
    AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
  ORDER BY vigente_desde DESC LIMIT 1;
  IF FOUND THEN _origin := 'cliente';
  ELSE
    SELECT * INTO t FROM public.tarifas
    WHERE activo AND cliente_id IS NULL
      AND lower(origen)=lower(_origen) AND lower(destino)=lower(_destino) AND servicio=_servicio
      AND vigente_desde <= CURRENT_DATE AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
    ORDER BY vigente_desde DESC LIMIT 1;
    IF FOUND THEN _origin := 'general';
    ELSE
      RETURN QUERY SELECT NULL::uuid, NULL::numeric, 'sin_tarifa'::text, NULL::numeric, NULL::numeric;
      RETURN;
    END IF;
  END IF;
  RETURN QUERY SELECT t.id,
    GREATEST(COALESCE(_peso_kg,0)*t.precio_por_kg, t.precio_minimo)::numeric,
    _origin, t.precio_por_kg, t.precio_minimo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sugerir_tarifa(uuid,text,text,text,numeric) TO authenticated;
