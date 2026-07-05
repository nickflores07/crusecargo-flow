import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const TokenSchema = z.string().regex(/^[a-f0-9]{20,80}$/i, "Token inválido");
const ActionSchema = z.object({
  action: z.enum(["aceptar", "rechazar"]),
  motivo: z.string().max(500).optional(),
  correo: z.string().email().max(200).optional(),
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/cotizacion/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = TokenSchema.safeParse(params.token);
        if (!parsed.success) return json({ error: "Token inválido" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cot, error } = await supabaseAdmin
          .from("cotizaciones")
          .select(
            "id, numero, fecha_emision, fecha_vencimiento, estado, subtotal, igv, total, moneda, incluye_igv, condiciones, motivo_rechazo, enviada_en, cliente_id, ejecutivo_id",
          )
          .eq("token_publico", parsed.data)
          .maybeSingle();

        if (error || !cot) return json({ error: "No encontrada" }, 404);

        const [{ data: items }, { data: cliente }, { data: ejec }] = await Promise.all([
          supabaseAdmin
            .from("cotizacion_items")
            .select("id, descripcion, origen, destino, servicio, peso_kg, bultos, cantidad, precio_unit, importe, orden")
            .eq("cotizacion_id", cot.id)
            .order("orden"),
          supabaseAdmin
            .from("clientes")
            .select("razon_social, nombre_completo, ruc, dni, ciudad, tipo")
            .eq("id", cot.cliente_id)
            .maybeSingle(),
          cot.ejecutivo_id
            ? supabaseAdmin.from("profiles").select("nombre").eq("id", cot.ejecutivo_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        return json({
          cotizacion: {
            numero: cot.numero,
            fecha_emision: cot.fecha_emision,
            fecha_vencimiento: cot.fecha_vencimiento,
            estado: cot.estado,
            subtotal: cot.subtotal,
            igv: cot.igv,
            total: cot.total,
            moneda: cot.moneda,
            incluye_igv: cot.incluye_igv,
            condiciones: cot.condiciones,
            motivo_rechazo: cot.motivo_rechazo,
            enviada_en: cot.enviada_en,
          },
          items: items ?? [],
          cliente: cliente
            ? {
                nombre:
                  cliente.tipo === "empresa" ? cliente.razon_social : cliente.nombre_completo,
                documento: cliente.tipo === "empresa" ? cliente.ruc : cliente.dni,
                ciudad: cliente.ciudad,
              }
            : null,
          ejecutivo: (ejec as { nombre?: string } | null)?.nombre ?? null,
        });
      },

      POST: async ({ params, request }) => {
        const parsedToken = TokenSchema.safeParse(params.token);
        if (!parsedToken.success) return json({ error: "Token inválido" }, 400);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Body inválido" }, 400);
        }
        const parsed = ActionSchema.safeParse(body);
        if (!parsed.success) return json({ error: "Datos inválidos" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: cot } = await supabaseAdmin
          .from("cotizaciones")
          .select("id, estado, numero, cliente_id, oportunidad_id, ejecutivo_id, total")
          .eq("token_publico", parsedToken.data)
          .maybeSingle();

        if (!cot) return json({ error: "No encontrada" }, 404);
        if (!["enviada", "pendiente", "borrador"].includes(cot.estado))
          return json({ error: "Esta cotización ya fue procesada." }, 409);

        if (parsed.data.action === "aceptar") {
          const { error: uErr } = await supabaseAdmin
            .from("cotizaciones")
            .update({ estado: "aceptada", enviada_a: parsed.data.correo ?? null })
            .eq("id", cot.id);
          if (uErr) return json({ error: uErr.message }, 500);

          // Registrar seguimiento
          await supabaseAdmin.from("seguimientos").insert({
            cliente_id: cot.cliente_id,
            tipo: "otro",
            usuario_id: cot.ejecutivo_id,
            resultado: `Cotización ${cot.numero} ACEPTADA por el cliente vía enlace público${
              parsed.data.correo ? ` (${parsed.data.correo})` : ""
            }. Total: S/ ${Number(cot.total).toFixed(2)}.`,
          });

          // Marcar oportunidad como ganada si existe
          if (cot.oportunidad_id) {
            await supabaseAdmin
              .from("oportunidades")
              .update({ estado: "ganada" })
              .eq("id", cot.oportunidad_id);
          }

          return json({ ok: true, estado: "aceptada" });
        }

        // rechazar
        const motivo = (parsed.data.motivo ?? "").trim();
        if (!motivo) return json({ error: "El motivo es obligatorio para rechazar." }, 400);

        const { error: uErr } = await supabaseAdmin
          .from("cotizaciones")
          .update({ estado: "rechazada", motivo_rechazo: motivo })
          .eq("id", cot.id);
        if (uErr) return json({ error: uErr.message }, 500);

        await supabaseAdmin.from("seguimientos").insert({
          cliente_id: cot.cliente_id,
          tipo: "otro",
          usuario_id: cot.ejecutivo_id,
          resultado: `Cotización ${cot.numero} RECHAZADA por el cliente vía enlace público. Motivo: ${motivo}`,
        });

        return json({ ok: true, estado: "rechazada" });
      },
    },
  },
});