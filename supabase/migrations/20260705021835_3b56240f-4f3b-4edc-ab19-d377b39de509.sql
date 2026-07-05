
-- Eliminar módulo "Envíos" (duplicaba lo que hace el ERP)
DELETE FROM public.permisos_modulos_usuario WHERE modulo_id = 'envios';
DELETE FROM public.permisos_modulos_rol WHERE modulo_id = 'envios';
DELETE FROM public.modulos_app WHERE id = 'envios';

-- La tabla envios se queda vacía y sin uso; la dejamos por si hay históricos,
-- pero limpiamos referencias no útiles. (No la eliminamos para no romper FKs
-- accidentales; el módulo ya no la usa desde el CRM.)

-- Agregamos un índice para acelerar el panel "Período histórico cargado"
CREATE INDEX IF NOT EXISTS idx_erp_staging_batch_fecha
  ON public.erp_ventas_staging(batch_id, fecha);
