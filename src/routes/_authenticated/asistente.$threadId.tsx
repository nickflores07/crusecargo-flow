import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { getMessages, confirmAction, rejectAction } from "@/lib/asistente.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Check, X, User as UserIcon, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/asistente/$threadId")({
  component: ChatPage,
});

type Propuesta = {
  action: "crear_seguimiento" | "crear_oportunidad";
  args: Record<string, any>;
  status: "pending" | "confirmed" | "rejected" | "failed";
  result_message?: string;
};
type MsgRow = { id: string; rol: string; contenido: { text?: string; propuestas?: Propuesta[] } };

function ChatPage() {
  const { threadId } = Route.useParams();
  const load = useServerFn(getMessages);
  const doConfirm = useServerFn(confirmAction);
  const doReject = useServerFn(rejectAction);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refresh = async () => {
    const data = await load({ data: { threadId } });
    setMessages(data as any);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [threadId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { textareaRef.current?.focus(); }, [threadId, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic user message
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, rol: "user", contenido: { text } }]);
    setInput("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ threadId, message: text }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 402) toast.error("Créditos de IA agotados. Agrega créditos en la configuración de Lovable Cloud.");
        else if (res.status === 429) toast.error("Demasiadas peticiones. Espera unos segundos.");
        else toast.error(body || "Error al consultar al asistente.");
      }
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Error de conexión");
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const approve = async (messageId: string, index: number) => {
    setBusyAction(`${messageId}-${index}`);
    try {
      const r = await doConfirm({ data: { threadId, messageId, actionIndex: index } });
      toast[r.ok ? "success" : "error"](r.message);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusyAction(null); }
  };
  const reject = async (messageId: string, index: number) => {
    setBusyAction(`${messageId}-${index}`);
    try { await doReject({ data: { messageId, actionIndex: index } }); await refresh(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusyAction(null); }
  };

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Pregúntame por un cliente, resúmenes, o pídeme redactar un correo.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex gap-3", m.rol === "user" ? "justify-end" : "justify-start")}>
              {m.rol === "assistant" && (
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                m.rol === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
              )}>
                {m.rol === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown>{m.contenido.text || ""}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.contenido.text}</div>
                )}
                {m.rol === "assistant" && (m.contenido.propuestas?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.contenido.propuestas!.map((p, i) => (
                      <PropuestaCard
                        key={i}
                        propuesta={p}
                        busy={busyAction === `${m.id}-${i}`}
                        onApprove={() => approve(m.id, i)}
                        onReject={() => reject(m.id, i)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {m.rol === "user" && (
                <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0">
                  <UserIcon className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-3 bg-background">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escribe tu mensaje… (Enter para enviar, Shift+Enter para salto de línea)"
            className="min-h-[44px] max-h-40 resize-none"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="h-11 w-11 shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PropuestaCard({
  propuesta, busy, onApprove, onReject,
}: { propuesta: Propuesta; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const label = propuesta.action === "crear_seguimiento" ? "Crear seguimiento" : "Crear oportunidad";
  const detalle = propuesta.action === "crear_seguimiento"
    ? `${propuesta.args.tipo} · ${propuesta.args.fecha}${propuesta.args.notas ? ` · ${propuesta.args.notas}` : ""}`
    : `${propuesta.args.titulo}${propuesta.args.monto_potencial ? ` · S/ ${propuesta.args.monto_potencial}` : ""}${propuesta.args.fecha_cierre_estimada ? ` · cierre ${propuesta.args.fecha_cierre_estimada}` : ""}`;

  return (
    <div className="rounded-md border bg-background/60 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{detalle}</p>
        </div>
        {propuesta.status === "pending" ? (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy} className="h-7 px-2">
              <X className="h-3 w-3" />
            </Button>
            <Button size="sm" onClick={onApprove} disabled={busy} className="h-7 px-2">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Aprobar
            </Button>
          </div>
        ) : propuesta.status === "confirmed" ? (
          <span className="text-xs text-green-600 flex items-center gap-1 shrink-0"><CheckCircle2 className="h-3.5 w-3.5" /> Hecho</span>
        ) : propuesta.status === "rejected" ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><XCircle className="h-3.5 w-3.5" /> Rechazada</span>
        ) : (
          <span className="text-xs text-red-600 flex items-center gap-1 shrink-0"><XCircle className="h-3.5 w-3.5" /> Error</span>
        )}
      </div>
      {propuesta.result_message && propuesta.status !== "pending" && (
        <p className="text-[10px] text-muted-foreground mt-1">{propuesta.result_message}</p>
      )}
    </div>
  );
}