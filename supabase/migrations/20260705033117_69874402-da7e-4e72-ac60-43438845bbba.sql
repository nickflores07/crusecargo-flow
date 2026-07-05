
ALTER TABLE public.visitas_planificadas
  ADD COLUMN IF NOT EXISTS oportunidad_id UUID REFERENCES public.oportunidades(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_visitas_planificadas_oportunidad ON public.visitas_planificadas(oportunidad_id);

ALTER TABLE public.visitas_planificadas DROP CONSTRAINT IF EXISTS visitas_tipo_check;
ALTER TABLE public.visitas_planificadas ADD CONSTRAINT visitas_tipo_check
  CHECK (tipo = ANY (ARRAY['visita'::text, 'prospeccion'::text, 'llamada'::text, 'reunion'::text, 'reunion_teams'::text, 'whatsapp'::text, 'otro'::text]));
