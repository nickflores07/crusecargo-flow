
ALTER VIEW public.erp_ventas_cliente_12m SET (security_invoker = true);
ALTER VIEW public.erp_ventas_ejecutivo_12m SET (security_invoker = true);

REVOKE ALL ON FUNCTION public.procesar_batch_erp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_batch_erp(uuid) TO authenticated;
