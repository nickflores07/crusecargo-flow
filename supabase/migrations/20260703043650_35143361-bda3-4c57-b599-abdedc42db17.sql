
REVOKE EXECUTE ON FUNCTION public.siguiente_numero_cotizacion() FROM authenticated;

CREATE OR REPLACE FUNCTION public.asignar_numero_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' OR NEW.numero = 'AUTO' THEN
    NEW.numero := public.siguiente_numero_cotizacion();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizaciones_numero ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_numero
  BEFORE INSERT ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.asignar_numero_cotizacion();
