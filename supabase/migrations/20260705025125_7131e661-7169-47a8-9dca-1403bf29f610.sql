DELETE FROM public.permisos_modulos_usuario WHERE modulo_id IN ('tarifario','comisiones','erp');
DELETE FROM public.permisos_modulos_rol WHERE modulo_id IN ('tarifario','comisiones','erp');
DELETE FROM public.modulos_app WHERE id IN ('tarifario','comisiones','erp');