
CREATE TABLE public.sectores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectores TO authenticated;
GRANT ALL ON public.sectores TO service_role;

ALTER TABLE public.sectores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sectores visibles para autenticados"
  ON public.sectores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo admin puede crear sectores"
  ON public.sectores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Solo admin puede editar sectores"
  ON public.sectores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Solo admin puede eliminar sectores"
  ON public.sectores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE TRIGGER trg_sectores_updated_at
  BEFORE UPDATE ON public.sectores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clientes
  ADD COLUMN sector_id UUID REFERENCES public.sectores(id) ON DELETE SET NULL;

CREATE INDEX idx_clientes_sector_id ON public.clientes(sector_id);

INSERT INTO public.sectores (nombre) VALUES
  ('Salud & Farma'),
  ('Publicidad & Trade Marketing'),
  ('Maquinaria Pesada & Equipos'),
  ('Transporte Terrestre & Rental'),
  ('Servicios de Ensayo & Laboratorios'),
  ('Entretenimiento & Recreación'),
  ('Retail Especializado (Electrónica/Telefonía)'),
  ('Construcción & Ingeniería'),
  ('Químicos Industriales & Especialidades'),
  ('Alimentos & Bebidas (Fabricación)'),
  ('Equipos/Servicios para Minería'),
  ('Autopartes & Neumáticos'),
  ('Editorial & Educación'),
  ('Retail Multicategoría'),
  ('Minería (Operadores)'),
  ('Metalurgia & Materiales'),
  ('BPO / Seguridad / Facility'),
  ('Servicios Financieros & Pensiones'),
  ('Logística Internacional & Forwarders'),
  ('Retail Especializado (Moda/Accesorios)'),
  ('Gas, Combustibles & Lubricantes'),
  ('Tabaco & Derivados'),
  ('Telecomunicaciones & Integradores'),
  ('Textil & Confección'),
  ('Químicos para Construcción'),
  ('Servicios Aeroportuarios'),
  ('Inmobiliario & Holding de Inversiones'),
  ('Tecnología (Software & Servicios)'),
  ('Tecnología (Hardware & Distribución)'),
  ('Retail Especializado (Oficina/Útiles)'),
  ('Religiosas / ONG / Asociaciones'),
  ('Cuidado Personal & Belleza'),
  ('Agro & Agrotech'),
  ('Educación & Investigación'),
  ('Restaurantes & Cadenas'),
  ('Energía Eléctrica'),
  ('Marítimo & Agenciamiento'),
  ('Hotelería & Turismo')
ON CONFLICT (nombre) DO NOTHING;
