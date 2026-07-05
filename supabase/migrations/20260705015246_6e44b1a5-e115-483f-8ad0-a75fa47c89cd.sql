
CREATE TABLE public.reglas_comision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ejecutivo_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('venta_erp','oportunidad_ganada')),
  porcentaje NUMERIC(6,3) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reglas_comision TO authenticated;
GRANT ALL ON public.reglas_comision TO service_role;

ALTER TABLE public.reglas_comision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ejecutivos ven sus reglas y las globales"
  ON public.reglas_comision FOR SELECT TO authenticated
  USING (ejecutivo_id = auth.uid() OR ejecutivo_id IS NULL
      OR public.has_role(auth.uid(),'administrador')
      OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "Admin/Supervisor gestionan reglas"
  ON public.reglas_comision FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'));

CREATE TRIGGER trg_reglas_comision_updated
  BEFORE UPDATE ON public.reglas_comision
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reglas_comision_ejec ON public.reglas_comision(ejecutivo_id) WHERE activo;

CREATE OR REPLACE FUNCTION public.calcular_comisiones(_mes TEXT)
RETURNS TABLE(
  ejecutivo_id UUID,
  ejecutivo_nombre TEXT,
  ventas_erp NUMERIC,
  pct_erp NUMERIC,
  comision_erp NUMERIC,
  monto_ganado_crm NUMERIC,
  pct_crm NUMERIC,
  comision_crm NUMERIC,
  total_comision NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _desde DATE := to_date(_mes || '-01','YYYY-MM-DD');
  _hasta DATE := (to_date(_mes || '-01','YYYY-MM-DD') + INTERVAL '1 month')::date;
BEGIN
  RETURN QUERY
  WITH ventas AS (
    SELECT s.ejecutivo_id, COALESCE(SUM(s.importe),0) AS total
      FROM public.erp_ventas_staging s
     WHERE s.procesado = true AND s.ejecutivo_id IS NOT NULL
       AND s.fecha >= _desde AND s.fecha < _hasta
     GROUP BY s.ejecutivo_id
  ),
  ganadas AS (
    SELECT c.ejecutivo_id, COALESCE(SUM(o.monto_estimado),0) AS total
      FROM public.oportunidades o
      JOIN public.clientes c ON c.id = o.cliente_id
     WHERE o.estado = 'ganada'
       AND o.updated_at >= _desde AND o.updated_at < _hasta
       AND c.ejecutivo_id IS NOT NULL
     GROUP BY c.ejecutivo_id
  ),
  ejecutivos AS (
    SELECT id FROM public.profiles WHERE id IN (SELECT ejecutivo_id FROM ventas)
    UNION SELECT id FROM public.profiles WHERE id IN (SELECT ejecutivo_id FROM ganadas)
  ),
  regla_erp AS (
    SELECT e.id AS ejec, COALESCE(
      (SELECT porcentaje FROM public.reglas_comision r
        WHERE r.tipo='venta_erp' AND r.activo AND r.ejecutivo_id = e.id
          AND r.vigente_desde <= _hasta AND (r.vigente_hasta IS NULL OR r.vigente_hasta >= _desde)
        ORDER BY r.vigente_desde DESC LIMIT 1),
      (SELECT porcentaje FROM public.reglas_comision r
        WHERE r.tipo='venta_erp' AND r.activo AND r.ejecutivo_id IS NULL
          AND r.vigente_desde <= _hasta AND (r.vigente_hasta IS NULL OR r.vigente_hasta >= _desde)
        ORDER BY r.vigente_desde DESC LIMIT 1),
      0) AS pct
    FROM ejecutivos e
  ),
  regla_crm AS (
    SELECT e.id AS ejec, COALESCE(
      (SELECT porcentaje FROM public.reglas_comision r
        WHERE r.tipo='oportunidad_ganada' AND r.activo AND r.ejecutivo_id = e.id
          AND r.vigente_desde <= _hasta AND (r.vigente_hasta IS NULL OR r.vigente_hasta >= _desde)
        ORDER BY r.vigente_desde DESC LIMIT 1),
      (SELECT porcentaje FROM public.reglas_comision r
        WHERE r.tipo='oportunidad_ganada' AND r.activo AND r.ejecutivo_id IS NULL
          AND r.vigente_desde <= _hasta AND (r.vigente_hasta IS NULL OR r.vigente_hasta >= _desde)
        ORDER BY r.vigente_desde DESC LIMIT 1),
      0) AS pct
    FROM ejecutivos e
  )
  SELECT e.id, p.nombre,
    COALESCE(v.total,0), COALESCE(re.pct,0),
    ROUND(COALESCE(v.total,0) * COALESCE(re.pct,0) / 100, 2),
    COALESCE(g.total,0), COALESCE(rc.pct,0),
    ROUND(COALESCE(g.total,0) * COALESCE(rc.pct,0) / 100, 2),
    ROUND(COALESCE(v.total,0) * COALESCE(re.pct,0) / 100
        + COALESCE(g.total,0) * COALESCE(rc.pct,0) / 100, 2)
  FROM ejecutivos e
  JOIN public.profiles p ON p.id = e.id
  LEFT JOIN ventas v  ON v.ejecutivo_id = e.id
  LEFT JOIN ganadas g ON g.ejecutivo_id = e.id
  LEFT JOIN regla_erp re ON re.ejec = e.id
  LEFT JOIN regla_crm rc ON rc.ejec = e.id
  WHERE public.has_role(auth.uid(),'administrador')
     OR public.has_role(auth.uid(),'supervisor')
     OR e.id = auth.uid()
  ORDER BY p.nombre;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calcular_comisiones(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comisiones(TEXT) TO authenticated;

INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden, descripcion)
VALUES ('comisiones', 'Comisiones', 'DollarSign', '/comisiones', 'menu', 90, 'Cálculo de comisiones por ventas del ERP y oportunidades ganadas del CRM')
ON CONFLICT (id) DO NOTHING;
