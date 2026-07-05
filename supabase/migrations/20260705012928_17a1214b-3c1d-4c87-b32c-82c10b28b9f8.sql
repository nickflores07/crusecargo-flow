
INSERT INTO public.modulos_app (id, nombre, icono, ruta, grupo, orden)
VALUES ('mi_dia', 'Mi día', 'Sunrise', '/mi-dia', 'menu', 15)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, icono = EXCLUDED.icono, ruta = EXCLUDED.ruta, grupo = EXCLUDED.grupo, orden = EXCLUDED.orden;
