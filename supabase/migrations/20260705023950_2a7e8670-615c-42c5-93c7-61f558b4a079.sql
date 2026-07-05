
ALTER TABLE public.visitas_planificadas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'visita',
  ADD COLUMN IF NOT EXISTS hora time,
  ADD COLUMN IF NOT EXISTS detalles text,
  ADD COLUMN IF NOT EXISTS logro text,
  ADD COLUMN IF NOT EXISTS proxima_accion text,
  ADD COLUMN IF NOT EXISTS proxima_accion_fecha date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visitas_tipo_check'
  ) THEN
    ALTER TABLE public.visitas_planificadas
      ADD CONSTRAINT visitas_tipo_check
      CHECK (tipo IN ('visita','prospeccion','llamada','reunion','otro'));
  END IF;
END $$;

UPDATE public.modulos_app
   SET nombre = 'Plan Semanal', icono = 'Calendar'
 WHERE id = 'rutas';
