
-- 1) Batches
CREATE TABLE public.erp_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ventas','envios','facturacion')),
  archivo_nombre TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total INT NOT NULL DEFAULT 0,
  ok INT NOT NULL DEFAULT 0,
  errores INT NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_import_batches TO authenticated;
GRANT ALL ON public.erp_import_batches TO service_role;
ALTER TABLE public.erp_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_batches_read" ON public.erp_import_batches FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "erp_batches_insert" ON public.erp_import_batches FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "erp_batches_update" ON public.erp_import_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "erp_batches_delete" ON public.erp_import_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrador'));

-- 2) Staging de ventas (unificada; sirve para ventas/envios/facturacion crudo)
CREATE TABLE public.erp_ventas_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.erp_import_batches(id) ON DELETE CASCADE,
  fecha DATE,
  ruc TEXT,
  cliente_nombre TEXT,
  ejecutivo_erp TEXT,
  servicio TEXT,
  origen TEXT,
  destino TEXT,
  guia_numero TEXT,
  monto NUMERIC(14,2),
  moneda TEXT DEFAULT 'PEN',
  peso_kg NUMERIC(12,2),
  datos_raw JSONB,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ejecutivo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  procesado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_ventas_staging TO authenticated;
GRANT ALL ON public.erp_ventas_staging TO service_role;
ALTER TABLE public.erp_ventas_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_staging_read" ON public.erp_ventas_staging FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.erp_import_batches b WHERE b.id = batch_id AND (b.uploaded_by = auth.uid() OR public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor')))
  );
CREATE POLICY "erp_staging_insert" ON public.erp_ventas_staging FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.erp_import_batches b WHERE b.id = batch_id AND b.uploaded_by = auth.uid())
  );
CREATE POLICY "erp_staging_update" ON public.erp_ventas_staging FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "erp_staging_delete" ON public.erp_ventas_staging FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'administrador'));

CREATE INDEX idx_erp_staging_batch ON public.erp_ventas_staging(batch_id);
CREATE INDEX idx_erp_staging_ruc ON public.erp_ventas_staging(ruc);
CREATE INDEX idx_erp_staging_ejec_erp ON public.erp_ventas_staging(ejecutivo_erp);
CREATE INDEX idx_erp_staging_fecha ON public.erp_ventas_staging(fecha);

-- 3) Mapeo de ejecutivos ERP -> CRM
CREATE TABLE public.erp_ejecutivos_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_erp TEXT NOT NULL,
  codigo_erp TEXT,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nombre_erp)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_ejecutivos_map TO authenticated;
GRANT ALL ON public.erp_ejecutivos_map TO service_role;
ALTER TABLE public.erp_ejecutivos_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_map_read_all" ON public.erp_ejecutivos_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "erp_map_write_admin" ON public.erp_ejecutivos_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'administrador') OR public.has_role(auth.uid(),'supervisor'));

CREATE TRIGGER trg_erp_map_updated
BEFORE UPDATE ON public.erp_ejecutivos_map
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Registrar módulo ERP
INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden)
VALUES ('erp', 'ERP / Cargas', 'Database', '/admin/erp', 'Administración', 90)
ON CONFLICT (id) DO NOTHING;
