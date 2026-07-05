
-- 1) RPC para procesar un batch: vincula cliente_id (crea si no existe) y ejecutivo_id
CREATE OR REPLACE FUNCTION public.procesar_batch_erp(_batch_id uuid)
RETURNS TABLE (
  procesadas int,
  con_cliente int,
  con_ejecutivo int,
  clientes_creados int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proc int := 0;
  _cli int := 0;
  _ejec int := 0;
  _creados int := 0;
  _row RECORD;
  _cid uuid;
  _eid uuid;
BEGIN
  -- Autorización: sólo admin o supervisor
  IF NOT (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor')) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR _row IN
    SELECT * FROM public.erp_ventas_staging WHERE batch_id = _batch_id
  LOOP
    _cid := NULL; _eid := NULL;

    -- Buscar cliente por RUC (empresa)
    IF _row.ruc IS NOT NULL AND length(btrim(_row.ruc)) > 0 THEN
      SELECT id INTO _cid FROM public.clientes WHERE ruc = btrim(_row.ruc) LIMIT 1;
      IF _cid IS NULL THEN
        INSERT INTO public.clientes (tipo, razon_social, ruc, estado, categoria_cliente, area_comercial)
        VALUES ('empresa', COALESCE(_row.cliente_nombre, _row.ruc), btrim(_row.ruc), 'activo', 'institucional', 'b2b')
        RETURNING id INTO _cid;
        _creados := _creados + 1;
      END IF;
    END IF;

    -- Ejecutivo por mapeo
    IF _row.ejecutivo_erp IS NOT NULL AND length(btrim(_row.ejecutivo_erp)) > 0 THEN
      SELECT profile_id INTO _eid
        FROM public.erp_ejecutivos_map
       WHERE lower(btrim(nombre_erp)) = lower(btrim(_row.ejecutivo_erp))
       LIMIT 1;
    END IF;

    UPDATE public.erp_ventas_staging
       SET cliente_id = _cid,
           ejecutivo_id = _eid,
           procesado = true
     WHERE id = _row.id;

    _proc := _proc + 1;
    IF _cid IS NOT NULL THEN _cli := _cli + 1; END IF;
    IF _eid IS NOT NULL THEN _ejec := _ejec + 1; END IF;

    -- Si el cliente no tiene ejecutivo asignado y el ERP conoce uno, se lo asignamos
    IF _cid IS NOT NULL AND _eid IS NOT NULL THEN
      UPDATE public.clientes SET ejecutivo_id = _eid
       WHERE id = _cid AND ejecutivo_id IS NULL;
    END IF;
  END LOOP;

  -- Notas del batch
  UPDATE public.erp_import_batches
     SET notas = format('Procesado: %s filas, %s con cliente, %s con ejecutivo, %s clientes creados',
                        _proc, _cli, _ejec, _creados)
   WHERE id = _batch_id;

  RETURN QUERY SELECT _proc, _cli, _ejec, _creados;
END;
$$;

REVOKE ALL ON FUNCTION public.procesar_batch_erp(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.procesar_batch_erp(uuid) TO authenticated;

-- 2) Vistas de resumen (últimos 12 meses)
CREATE OR REPLACE VIEW public.erp_ventas_cliente_12m AS
SELECT
  cliente_id,
  COUNT(*)::int AS num_operaciones,
  SUM(monto)::numeric(14,2) AS total,
  AVG(monto)::numeric(14,2) AS ticket_promedio,
  MAX(fecha) AS ultima_venta
FROM public.erp_ventas_staging
WHERE procesado = true
  AND cliente_id IS NOT NULL
  AND fecha >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY cliente_id;

GRANT SELECT ON public.erp_ventas_cliente_12m TO authenticated;

CREATE OR REPLACE VIEW public.erp_ventas_ejecutivo_12m AS
SELECT
  ejecutivo_id,
  COUNT(DISTINCT cliente_id)::int AS clientes_atendidos,
  COUNT(*)::int AS num_operaciones,
  SUM(monto)::numeric(14,2) AS total
FROM public.erp_ventas_staging
WHERE procesado = true
  AND ejecutivo_id IS NOT NULL
  AND fecha >= (CURRENT_DATE - INTERVAL '12 months')
GROUP BY ejecutivo_id;

GRANT SELECT ON public.erp_ventas_ejecutivo_12m TO authenticated;
