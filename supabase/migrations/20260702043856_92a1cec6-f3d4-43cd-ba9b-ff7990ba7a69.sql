
CREATE TYPE public.categoria_cliente AS ENUM ('institucional', 'comun');
CREATE TYPE public.area_comercial AS ENUM ('b2b', 'b2c');

ALTER TABLE public.clientes
  ADD COLUMN categoria_cliente public.categoria_cliente NOT NULL DEFAULT 'comun',
  ADD COLUMN area_comercial public.area_comercial NOT NULL DEFAULT 'b2c',
  ADD COLUMN canal TEXT;

-- Regla: B2B solo admite clientes institucionales
CREATE OR REPLACE FUNCTION public.validar_area_categoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.area_comercial = 'b2b' AND NEW.categoria_cliente <> 'institucional' THEN
    RAISE EXCEPTION 'El área B2B solo puede atender clientes de categoría Institucional';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_area_categoria
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.validar_area_categoria();
