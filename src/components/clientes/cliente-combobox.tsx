import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ClienteMini = {
  id: string;
  tipo: "empresa" | "persona";
  razon_social: string | null;
  nombre_completo: string | null;
  ruc: string | null;
  dni: string | null;
  correo: string | null;
  ciudad: string | null;
};

export const clienteLabel = (c?: ClienteMini | null) =>
  !c ? "" : (c.tipo === "empresa" ? c.razon_social : c.nombre_completo) || "(sin nombre)";

export const clienteDoc = (c?: ClienteMini | null) =>
  !c ? "" : (c.tipo === "empresa" ? c.ruc : c.dni) || "";

export function useClientes() {
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, tipo, razon_social, nombre_completo, ruc, dni, correo, ciudad")
        .order("created_at", { ascending: false });
      if (!alive) return;
      setClientes((data ?? []) as ClienteMini[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);
  return { clientes, loading };
}

export function ClienteCombobox({
  clientes,
  value,
  onChange,
  placeholder = "Selecciona un cliente…",
  disabled,
  className,
}: {
  clientes: ClienteMini[];
  value: string;
  onChange: (id: string, cliente: ClienteMini | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = clientes.find((c) => c.id === value) || null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {current ? (
            <span className="truncate">
              {clienteLabel(current)}
              {clienteDoc(current) && (
                <span className="text-muted-foreground"> · {clienteDoc(current)}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command
          filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Buscar por nombre, RUC o DNI…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => {
                const label = clienteLabel(c);
                const doc = clienteDoc(c);
                return (
                  <CommandItem
                    key={c.id}
                    value={`${label} ${doc} ${c.correo ?? ""}`}
                    onSelect={() => { onChange(c.id, c); setOpen(false); }}
                  >
                    <Check className={cn("h-4 w-4 mr-2", value === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {doc || "—"}{c.ciudad ? ` · ${c.ciudad}` : ""}{c.correo ? ` · ${c.correo}` : ""}
                      </p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ClienteComboboxLoader(props: Omit<Parameters<typeof ClienteCombobox>[0], "clientes">) {
  const { clientes, loading } = useClientes();
  if (loading) return (
    <Button type="button" variant="outline" disabled className="w-full justify-between font-normal">
      <span className="text-muted-foreground">Cargando clientes…</span>
      <Loader2 className="h-4 w-4 animate-spin" />
    </Button>
  );
  return <ClienteCombobox {...props} clientes={clientes} />;
}