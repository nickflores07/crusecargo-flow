
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_area_categoria() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_oportunidad_perdida() FROM PUBLIC, anon, authenticated;
-- has_role must remain executable: it is used inside RLS policies and via RPC from authenticated server functions to check admin status.
