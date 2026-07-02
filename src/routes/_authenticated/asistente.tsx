import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/asistente.functions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/asistente")({
  component: AsistenteLayout,
});

function AsistenteLayout() {
  const navigate = useNavigate();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const [threads, setThreads] = useState<Array<{ id: string; titulo: string; updated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams({ strict: false }) as { threadId?: string };

  const refresh = async () => {
    setLoading(true);
    const t = await list();
    setThreads(t as any);
    setLoading(false);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const newThread = async () => {
    const t = await create();
    await refresh();
    navigate({ to: "/asistente/$threadId", params: { threadId: t.id } });
  };

  const onDelete = async (id: string) => {
    await remove({ data: { id } });
    if (params.threadId === id) navigate({ to: "/asistente" });
    refresh();
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      <aside className="w-64 shrink-0 flex flex-col border rounded-lg bg-card">
        <div className="p-3 border-b flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Asistente IA</span>
        </div>
        <div className="p-2">
          <Button size="sm" className="w-full" onClick={newThread}>
            <Plus className="h-4 w-4 mr-1" /> Nueva conversación
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="text-xs text-muted-foreground px-2 py-4 text-center flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
              </div>
            ) : threads.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">Sin conversaciones aún.</p>
            ) : threads.map((t) => (
              <div key={t.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted", params.threadId === t.id && "bg-muted")}>
                <Link
                  to="/asistente/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0 flex items-center gap-2"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.titulo}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                  aria-label="Eliminar conversación"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>
      <section className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden">
        <Outlet />
      </section>
    </div>
  );
}