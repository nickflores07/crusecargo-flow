import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_threads")
      .select("id, titulo, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_threads")
      .insert({ user_id: context.userId, titulo: "Nueva conversación" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data as { id: string };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: uuid }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: uuid, titulo: z.string().min(1).max(120) }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_threads")
      .update({ titulo: data.titulo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ threadId: uuid }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("id, rol, contenido, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const confirmAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({
      threadId: uuid,
      messageId: uuid,
      actionIndex: z.number().int().min(0),
    }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msg, error: mErr } = await supabase
      .from("ai_messages")
      .select("id, contenido")
      .eq("id", data.messageId)
      .single();
    if (mErr || !msg) throw new Error(mErr?.message || "Mensaje no encontrado");
    const contenido = msg.contenido as { propuestas?: any[] };
    const propuestas = contenido.propuestas ?? [];
    const p = propuestas[data.actionIndex];
    if (!p || p.status !== "pending") throw new Error("Propuesta no válida");

    let result: { ok: boolean; message: string } = { ok: false, message: "" };
    try {
      if (p.action === "crear_seguimiento") {
        const { error } = await supabase.from("seguimientos").insert({
          cliente_id: p.args.cliente_id,
          user_id: userId,
          tipo: p.args.tipo,
          fecha: p.args.fecha,
          resultado: p.args.notas ?? "",
        });
        if (error) throw error;
        result = { ok: true, message: "Seguimiento creado" };
      } else if (p.action === "crear_oportunidad") {
        const { error } = await supabase.from("oportunidades").insert({
          cliente_id: p.args.cliente_id,
          ejecutivo_id: userId,
          titulo: p.args.titulo,
          monto_estimado: p.args.monto_estimado ?? null,
          probabilidad: p.args.probabilidad ?? 25,
          fecha_cierre_estimada: p.args.fecha_cierre_estimada ?? null,
          estado: "en_proceso",
        });
        if (error) throw error;
        result = { ok: true, message: "Oportunidad creada" };
      } else {
        throw new Error(`Acción no soportada: ${p.action}`);
      }
    } catch (e: any) {
      result = { ok: false, message: e.message || "Error al ejecutar la acción" };
    }

    propuestas[data.actionIndex] = {
      ...p,
      status: result.ok ? "confirmed" : "failed",
      result_message: result.message,
    };
    const { error: uErr } = await supabase
      .from("ai_messages")
      .update({ contenido: { ...contenido, propuestas } })
      .eq("id", data.messageId);
    if (uErr) throw new Error(uErr.message);
    return result;
  });

export const rejectAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) =>
    z.object({ messageId: uuid, actionIndex: z.number().int().min(0) }).parse(v),
  )
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("ai_messages")
      .select("contenido")
      .eq("id", data.messageId)
      .single();
    if (error || !msg) throw new Error(error?.message || "No encontrado");
    const contenido = msg.contenido as { propuestas?: any[] };
    const propuestas = contenido.propuestas ?? [];
    const p = propuestas[data.actionIndex];
    if (!p) throw new Error("Propuesta no válida");
    propuestas[data.actionIndex] = { ...p, status: "rejected", result_message: "Rechazada" };
    const { error: uErr } = await context.supabase
      .from("ai_messages")
      .update({ contenido: { ...contenido, propuestas } })
      .eq("id", data.messageId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });