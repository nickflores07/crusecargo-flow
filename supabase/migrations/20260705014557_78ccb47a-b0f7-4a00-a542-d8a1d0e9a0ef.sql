
CREATE TABLE public.visitas_planificadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ejecutivo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  fecha_planificada DATE NOT NULL,
  motivo TEXT,
  estado TEXT NOT NULL DEFAULT 'planificada'
    CHECK (estado IN ('planificada','realizada','reprogramada','cancelada')),
  resultado TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas_planificadas TO authenticated;
GRANT ALL ON public.visitas_planificadas TO service_role;
ALTER TABLE public.visitas_planificadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitas_read" ON public.visitas_planificadas FOR SELECT TO authenticated
  USING (ejecutivo_id = auth.uid()
    OR public.has_role(auth.uid(),'administrador')
    OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "visitas_insert" ON public.visitas_planificadas FOR INSERT TO authenticated
  WITH CHECK (ejecutivo_id = auth.uid()
    OR public.has_role(auth.uid(),'administrador')
    OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "visitas_update" ON public.visitas_planificadas FOR UPDATE TO authenticated
  USING (ejecutivo_id = auth.uid()
    OR public.has_role(auth.uid(),'administrador')
    OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "visitas_delete" ON public.visitas_planificadas FOR DELETE TO authenticated
  USING (ejecutivo_id = auth.uid()
    OR public.has_role(auth.uid(),'administrador'));

CREATE INDEX idx_visitas_ejec_fecha ON public.visitas_planificadas(ejecutivo_id, fecha_planificada);
CREATE INDEX idx_visitas_cliente ON public.visitas_planificadas(cliente_id);

CREATE TRIGGER trg_visitas_updated
BEFORE UPDATE ON public.visitas_planificadas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden)
VALUES
  ('rutas', 'Rutas', 'Map', '/rutas', 'menu', 55),
  ('reportes', 'Reportes', 'BarChart3', '/reportes', 'menu', 60)
ON CONFLICT (id) DO NOTHING;
