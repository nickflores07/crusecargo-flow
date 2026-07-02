import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleEnum = z.enum(["administrador", "supervisor", "ejecutivo"]);

const inviteSchema = z.object({
  email: z.string().email("Correo inválido").max(255),
  nombre: z.string().trim().min(2, "Nombre muy corto").max(120),
  rol: roleEnum.default("ejecutivo"),
});

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que el llamante sea administrador (usando el cliente del usuario, respeta RLS)
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    if (roleError) throw new Response(roleError.message, { status: 500 });
    if (!isAdmin) throw new Response("Solo administradores pueden invitar miembros.", { status: 403 });

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { nombre: data.nombre },
    });
    if (error) throw new Response(error.message, { status: 400 });

    const newUserId = invited.user?.id;
    if (newUserId) {
      // Aseguramos el nombre exacto en profiles (por si el trigger prioriza otro campo)
      await supabaseAdmin.from("profiles").update({ nombre: data.nombre }).eq("id", newUserId);
      // Ajustamos rol si no es el por defecto
      if (data.rol !== "ejecutivo") {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
        await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.rol });
      }
    }
    return { ok: true as const, userId: newUserId ?? null };
  });

const updateNombreSchema = z.object({
  userId: z.string().uuid(),
  nombre: z.string().trim().min(2).max(120),
});

export const updateMemberName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateNombreSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "administrador",
    });
    if (!isAdmin) throw new Response("Solo administradores.", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ nombre: data.nombre }).eq("id", data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true as const };
  });