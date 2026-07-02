import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `Eres el asistente comercial de Cruz del Sur Cargo, una empresa peruana de envíos de última milla.

Ayudas al equipo comercial (ejecutivos, supervisores, administradores) a:
- Consultar información sobre clientes, oportunidades, envíos, cotizaciones y seguimientos.
- Redactar correos, propuestas y mensajes de WhatsApp cortos y profesionales en español (peruano, cordial).
- Preparar resúmenes ejecutivos y siguientes pasos.
- Proponer acciones (crear seguimientos u oportunidades) — SIEMPRE usando las herramientas 'proponer_*'.
  Nunca inventes IDs; primero usa 'buscar_cliente' para obtener el cliente_id real.

Reglas:
- Todas las cifras van en soles (PEN).
- No inventes datos. Si no encuentras algo, dilo claramente.
- Sé breve y accionable. Usa listas y negritas cuando sea útil.
- Responde siempre en español.
`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization");
          const token = auth?.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401 });

          const body = (await request.json()) as { threadId?: string; message?: string };
          if (!body.threadId || !body.message?.trim()) {
            return new Response("Bad request", { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

          const supabase = createClient<Database>(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            },
          );

          const { data: userRes, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userRes.user) return new Response("Unauthorized", { status: 401 });
          const userId = userRes.user.id;

          // Persist user message
          await supabase.from("ai_messages").insert({
            thread_id: body.threadId,
            user_id: userId,
            rol: "user",
            contenido: { text: body.message },
          });

          // Load conversation history (last 30 turns)
          const { data: hist } = await supabase
            .from("ai_messages")
            .select("rol, contenido")
            .eq("thread_id", body.threadId)
            .order("created_at", { ascending: true })
            .limit(30);

          const messages = (hist ?? [])
            .filter((m) => m.rol === "user" || m.rol === "assistant")
            .map((m) => ({
              role: m.rol as "user" | "assistant",
              content: (m.contenido as any)?.text ?? "",
            }))
            .filter((m) => m.content);

          const propuestas: any[] = [];

          const tools = {
            buscar_cliente: tool({
              description: "Busca clientes por nombre, RUC/DNI o teléfono. Devuelve máximo 8 coincidencias.",
              inputSchema: z.object({ query: z.string().describe("Texto a buscar") }),
              execute: async ({ query }) => {
                const like = `%${query}%`;
                const { data, error } = await supabase
                  .from("clientes")
                  .select("id, nombre_completo, razon_social, ruc, telefono, area_comercial, categoria_cliente, canal, estado")
                  .or(`nombre_completo.ilike.${like},razon_social.ilike.${like},ruc.ilike.${like},telefono.ilike.${like}`)
                  .limit(8);
                if (error) return { error: error.message };
                return { resultados: data ?? [] };
              },
            }),
            resumen_cliente: tool({
              description: "Obtiene un resumen del cliente: últimos envíos, oportunidades abiertas y cotizaciones vigentes.",
              inputSchema: z.object({ cliente_id: z.string().uuid() }),
              execute: async ({ cliente_id }) => {
                const [cli, ops, env, cot, seg] = await Promise.all([
                  supabase.from("clientes").select("nombre_completo, razon_social, area_comercial, categoria_cliente, canal, estado").eq("id", cliente_id).maybeSingle(),
                  supabase.from("oportunidades").select("id, titulo, estado, monto_potencial, fecha_cierre_estimada").eq("cliente_id", cliente_id).order("updated_at", { ascending: false }).limit(10),
                  supabase.from("envios").select("fecha, servicio, origen, destino, importe, estado").eq("cliente_id", cliente_id).order("fecha", { ascending: false }).limit(10),
                  supabase.from("cotizaciones").select("numero, fecha_emision, total, estado").eq("cliente_id", cliente_id).order("fecha_emision", { ascending: false }).limit(10),
                  supabase.from("seguimientos").select("fecha, tipo, resultado").eq("cliente_id", cliente_id).order("fecha", { ascending: false }).limit(5),
                ]);
                return {
                  cliente: cli.data,
                  oportunidades: ops.data ?? [],
                  envios: env.data ?? [],
                  cotizaciones: cot.data ?? [],
                  seguimientos: seg.data ?? [],
                };
              },
            }),
            estadisticas_generales: tool({
              description: "KPIs actuales: total de clientes activos, oportunidades abiertas, envíos del mes y ventas del mes en soles.",
              inputSchema: z.object({}),
              execute: async () => {
                const now = new Date();
                const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
                const [cli, ops, env] = await Promise.all([
                  supabase.from("clientes").select("id", { count: "exact", head: true }).eq("estado", "activo"),
                  supabase.from("oportunidades").select("id, monto_potencial", { count: "exact" }).eq("estado", "en_proceso"),
                  supabase.from("envios").select("importe").gte("fecha", mk),
                ]);
                const ventasMes = (env.data ?? []).reduce((a: number, r: any) => a + Number(r.importe || 0), 0);
                return {
                  clientes_activos: cli.count ?? 0,
                  oportunidades_abiertas: ops.count ?? 0,
                  envios_del_mes: env.data?.length ?? 0,
                  ventas_mes_pen: ventasMes,
                };
              },
            }),
            oportunidades_por_cerrar: tool({
              description: "Oportunidades abiertas cuya fecha_cierre_estimada cae en los próximos N días (default 14).",
              inputSchema: z.object({ dias: z.number().int().min(1).max(90).default(14) }),
              execute: async ({ dias }) => {
                const hoy = new Date().toISOString().slice(0, 10);
                const hasta = new Date(); hasta.setDate(hasta.getDate() + dias);
                const { data, error } = await supabase
                  .from("oportunidades")
                  .select("id, titulo, estado, monto_potencial, fecha_cierre_estimada, cliente_id, clientes(nombre_completo, razon_social)")
                  .eq("estado", "en_proceso")
                  .not("fecha_cierre_estimada", "is", null)
                  .gte("fecha_cierre_estimada", hoy)
                  .lte("fecha_cierre_estimada", hasta.toISOString().slice(0, 10))
                  .order("fecha_cierre_estimada", { ascending: true });
                if (error) return { error: error.message };
                return { oportunidades: data ?? [] };
              },
            }),
            proponer_crear_seguimiento: tool({
              description: "Propone al usuario crear un seguimiento comercial (llamada, visita, correo, whatsapp, reunion). NO lo crea directamente; se agrega como propuesta para que el usuario apruebe.",
              inputSchema: z.object({
                cliente_id: z.string().uuid().describe("ID del cliente (obtenido con buscar_cliente)"),
                tipo: z.enum(["llamada", "visita", "correo", "whatsapp", "reunion"]),
                fecha: z.string().describe("Fecha ISO (YYYY-MM-DD)"),
                notas: z.string().optional(),
              }),
              execute: async (args) => {
                propuestas.push({ action: "crear_seguimiento", args, status: "pending" });
                return { propuesta_registrada: true, mensaje: "Propuesta lista para aprobación del usuario." };
              },
            }),
            proponer_crear_oportunidad: tool({
              description: "Propone al usuario crear una oportunidad comercial. NO la crea; queda pendiente de aprobación.",
              inputSchema: z.object({
                cliente_id: z.string().uuid(),
                titulo: z.string(),
                monto_potencial: z.number().optional(),
                probabilidad: z.number().int().min(0).max(100).optional(),
                fecha_cierre_estimada: z.string().optional().describe("Fecha ISO YYYY-MM-DD"),
              }),
              execute: async (args) => {
                propuestas.push({ action: "crear_oportunidad", args, status: "pending" });
                return { propuesta_registrada: true, mensaje: "Propuesta lista para aprobación del usuario." };
              },
            }),
          };

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const { text } = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages,
            tools,
            stopWhen: stepCountIs(50),
          });

          const assistantContent = { text: text || "(sin respuesta)", propuestas };
          const { data: saved, error: sErr } = await supabase
            .from("ai_messages")
            .insert({
              thread_id: body.threadId,
              user_id: userId,
              rol: "assistant",
              contenido: assistantContent,
            })
            .select("id")
            .single();
          if (sErr) return new Response(sErr.message, { status: 500 });

          // Bump thread updated_at + set title if it's still default
          await supabase.from("ai_threads").update({ updated_at: new Date().toISOString() }).eq("id", body.threadId);
          const { data: th } = await supabase.from("ai_threads").select("titulo").eq("id", body.threadId).single();
          if (th?.titulo === "Nueva conversación") {
            await supabase.from("ai_threads").update({
              titulo: body.message.slice(0, 60),
            }).eq("id", body.threadId);
          }

          return Response.json({ id: saved.id, ...assistantContent });
        } catch (e: any) {
          const msg = e?.message || "Error";
          const status = /rate|429/i.test(msg) ? 429 : /payment|402|credit/i.test(msg) ? 402 : 500;
          return new Response(msg, { status });
        }
      },
    },
  },
});