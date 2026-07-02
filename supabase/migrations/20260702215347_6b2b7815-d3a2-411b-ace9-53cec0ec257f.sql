
-- Enums
CREATE TYPE public.envio_estado AS ENUM ('en_transito','entregado','devuelto','anulado');
CREATE TYPE public.cotizacion_estado AS ENUM ('borrador','enviada','pendiente','aceptada','rechazada','vencida');

-- =========================
-- envios
-- =========================
CREATE TABLE public.envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ejecutivo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  guia TEXT,
  servicio TEXT,
  origen TEXT,
  destino TEXT,
  peso_kg NUMERIC(10,2),
  bultos INTEGER,
  importe NUMERIC(12,2),
  estado public.envio_estado NOT NULL DEFAULT 'en_transito',
  notas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX envios_cliente_fecha_idx ON public.envios (cliente_id, fecha DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.envios TO authenticated;
GRANT ALL ON public.envios TO service_role;

ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envíos: acceso por cliente asignado o admin/supervisor"
ON public.envios FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = envios.cliente_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = envios.cliente_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
);

CREATE TRIGGER envios_set_updated_at
BEFORE UPDATE ON public.envios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- cotizaciones
-- =========================
CREATE TABLE public.cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ejecutivo_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado public.cotizacion_estado NOT NULL DEFAULT 'borrador',
  moneda TEXT NOT NULL DEFAULT 'PEN',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  igv NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cotizaciones_cliente_fecha_idx ON public.cotizaciones (cliente_id, fecha_emision DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizaciones TO authenticated;
GRANT ALL ON public.cotizaciones TO service_role;

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cotizaciones: acceso por cliente asignado o admin/supervisor"
ON public.cotizaciones FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cotizaciones.cliente_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = cotizaciones.cliente_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
);

CREATE TRIGGER cotizaciones_set_updated_at
BEFORE UPDATE ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- cotizacion_items
-- =========================
CREATE TABLE public.cotizacion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  precio_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cotizacion_items_cot_idx ON public.cotizacion_items (cotizacion_id, orden);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_items TO authenticated;
GRANT ALL ON public.cotizacion_items TO service_role;

ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ítems: acceso heredado de la cotización"
ON public.cotizacion_items FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.cotizaciones q
    JOIN public.clientes c ON c.id = q.cliente_id
    WHERE q.id = cotizacion_items.cotizacion_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.cotizaciones q
    JOIN public.clientes c ON c.id = q.cliente_id
    WHERE q.id = cotizacion_items.cotizacion_id
      AND (
        c.ejecutivo_id = auth.uid()
        OR public.has_role(auth.uid(), 'administrador')
        OR public.has_role(auth.uid(), 'supervisor')
      )
  )
);
