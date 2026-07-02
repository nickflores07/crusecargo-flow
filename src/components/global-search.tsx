import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { Users, Target, User as UserIcon, Loader2 } from "lucide-react";

type Cliente = { id: string; nombre_completo: string | null; razon_social: string | null; ruc: string | null; telefono: string | null };
type Contacto = { id: string; nombre: string; cliente_id: string; correo: string | null; celular: string | null };
type Oportunidad = { id: string; titulo: string | null; cliente_id: string; estado: string | null };

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setClientes([]); setContactos([]); setOportunidades([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    const like = `%${term}%`;
    (async () => {
      const [c, k, o] = await Promise.all([
        supabase.from("clientes")
          .select("id, nombre_completo, razon_social, ruc, telefono")
          .or(`nombre_completo.ilike.${like},razon_social.ilike.${like},ruc.ilike.${like},telefono.ilike.${like}`)
          .limit(6),
        supabase.from("contactos")
          .select("id, nombre, cliente_id, correo, celular")
          .or(`nombre.ilike.${like},correo.ilike.${like},celular.ilike.${like}`)
          .limit(6),
        supabase.from("oportunidades")
          .select("id, titulo, cliente_id, estado")
          .ilike("titulo", like)
          .limit(6),
      ]);
      if (cancel) return;
        setClientes((c.data as unknown as Cliente[]) ?? []);
        setContactos((k.data as unknown as Contacto[]) ?? []);
        setOportunidades((o.data as unknown as Oportunidad[]) ?? []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [q, open]);

  const go = (path: string) => {
    onOpenChange(false);
    setQ("");
    navigate({ to: path });
  };

  const empty = !loading && q.trim().length >= 2 && !clientes.length && !contactos.length && !oportunidades.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar cliente, contacto u oportunidad…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando…
          </div>
        )}
        {!loading && q.trim().length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Escribe al menos 2 caracteres para buscar.
          </div>
        )}
        {empty && <CommandEmpty>Sin resultados.</CommandEmpty>}

        {clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientes.map((c) => (
              <CommandItem key={c.id} value={`c-${c.id}`} onSelect={() => go(`/clientes/${c.id}`)}>
                <Users className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>{c.nombre_completo || c.razon_social || "Sin nombre"}</span>
                  <span className="text-xs text-muted-foreground">{c.ruc || c.telefono || ""}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contactos.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contactos">
              {contactos.map((k) => (
                <CommandItem key={k.id} value={`k-${k.id}`} onSelect={() => go(`/clientes/${k.cliente_id}`)}>
                  <UserIcon className="h-4 w-4 mr-2" />
                  <div className="flex flex-col">
                    <span>{k.nombre || "Sin nombre"}</span>
                    <span className="text-xs text-muted-foreground">{k.correo || k.celular || ""}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {oportunidades.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Oportunidades">
              {oportunidades.map((o) => (
                <CommandItem key={o.id} value={`o-${o.id}`} onSelect={() => go(`/oportunidades`)}>
                  <Target className="h-4 w-4 mr-2" />
                  <div className="flex flex-col">
                    <span>{o.titulo || "Sin título"}</span>
                    <span className="text-xs text-muted-foreground capitalize">{o.estado || ""}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}