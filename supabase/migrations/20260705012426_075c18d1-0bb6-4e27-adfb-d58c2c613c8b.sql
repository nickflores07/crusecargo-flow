
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS fuente_prospeccion text,
  ADD COLUMN IF NOT EXISTS probabilidad_cierre smallint NOT NULL DEFAULT 0 CHECK (probabilidad_cierre BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS valor_estimado_mensual numeric(12,2),
  ADD COLUMN IF NOT EXISTS proximo_contacto_en date,
  ADD COLUMN IF NOT EXISTS ultimo_contacto_en date;

CREATE INDEX IF NOT EXISTS idx_clientes_estado_ejecutivo ON public.clientes(estado, ejecutivo_id);
CREATE INDEX IF NOT EXISTS idx_clientes_proximo_contacto ON public.clientes(proximo_contacto_en) WHERE proximo_contacto_en IS NOT NULL;

INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden)
VALUES ('prospeccion', 'Prospección', 'Target', '/prospeccion', 'menu', 25)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, icono = EXCLUDED.icono, ruta = EXCLUDED.ruta, grupo = EXCLUDED.grupo, orden = EXCLUDED.orden;
