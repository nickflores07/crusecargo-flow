
# Plan: Cotizaciones profesionales + Tarifario + Envíos como termómetro comercial

Objetivo: convertir el CRM en un complemento real a Cargo. El ejecutivo cotiza rápido con tarifas pre-cargadas, envía la cotización por correo con formato profesional, y el módulo Envíos deja de duplicar operación para volverse un termómetro comercial (volumen, caída de clientes, seguimiento de promesas).

---

## 1. Nuevo módulo: Tarifario

Base de precios por ruta/cliente que hoy vive en Cargo, replicada aquí para que Cotizaciones autocalcule.

Tabla `tarifas`:
- `origen`, `destino` (texto)
- `servicio` (encomienda, carga, paquetería…)
- `cliente_id` (nullable → tarifa general si es null, específica si apunta a un cliente)
- `precio_por_kg` (S/), `precio_minimo` (S/), `peso_minimo_kg`
- `vigente_desde`, `vigente_hasta`
- `notas`, `activo`

Pantalla `/tarifario` (solo admin y coordinador):
- Tabla con búsqueda por ruta/cliente, filtros por servicio y vigencia.
- Botón **Importar CSV/Excel** (plantilla descargable: origen, destino, servicio, cliente_ruc opcional, precio_por_kg, precio_minimo, peso_minimo, vigente_desde, vigente_hasta). Preview antes de confirmar; mapea `cliente_ruc` → `cliente_id`.
- Alta/edición manual de tarifas puntuales.
- Historial: al editar una tarifa vigente, se cierra la anterior con `vigente_hasta = hoy` y se crea la nueva (auditoría).

Función `sugerir_tarifa(cliente_id, origen, destino, servicio, peso_kg)` (RPC):
1. Busca tarifa activa cliente-específica → si existe, usa esa.
2. Si no, busca tarifa activa general para esa ruta+servicio.
3. Calcula `max(peso_kg * precio_por_kg, precio_minimo)`.
4. Devuelve `{ precio_sugerido, tarifa_id, origen_tarifa: 'cliente'|'general'|'sin_tarifa' }`.

---

## 2. Cotizaciones — rediseño completo

### 2a. Editor
- **Cliente**: combobox buscable (reusa el de Oportunidades). Muestra RUC + razón social + correo por defecto.
- **Correo destino**: se autocompleta con el correo del cliente pero es editable. Botón "+ agregar CC" para copiar a otros correos (permite cualquier correo, no tiene que existir en Clientes).
- **Oportunidad vinculada** (opcional): combobox de oportunidades abiertas de ese cliente. Si viene desde el detalle de una oportunidad, ya viene precargada.
- **Items dinámicos** (múltiples rutas por cotización). Cada fila:
  - Origen, Destino (autocompletado con rutas existentes en tarifario)
  - Servicio, Peso estimado (kg), Bultos
  - Precio unitario (S/): se **sugiere automáticamente** con `sugerir_tarifa`; badge "Tarifa cliente" / "Tarifa general" / "Sin tarifa — ingresa manual"
  - Precio editable (ejecutivo puede sobreescribir; se guarda `precio_sugerido` + `precio_final` para métrica de descuentos)
  - Subtotal automático
- **Totales**: subtotal, IGV 18%, total. Selector "Precios incluyen IGV / más IGV".
- **Vigencia**: días de validez (default 15) → calcula `valido_hasta`.
- **Condiciones comerciales**: campo largo con texto default configurable (formas de pago, tiempos de tránsito, exclusiones).
- **Notas internas**: no aparecen en el PDF/correo.

### 2b. Vista de cotización + PDF
- Vista `/cotizaciones/:id` con formato imprimible tipo documento comercial:
  - Header con logo Cruz del Sur Cargo, número correlativo (`COT-2026-000123`), fecha, validez.
  - Datos del cliente (razón social, RUC, contacto).
  - Tabla de items con ruta, servicio, peso, precio unitario, subtotal.
  - Totales, condiciones, ejecutivo responsable, firma.
- Botones: **Descargar PDF**, **Enviar por correo**, **Duplicar**, **Marcar como enviada/aceptada/rechazada**.
- PDF generado server-side (React → HTML → PDF) para tener el mismo layout que el correo.

### 2c. Envío por correo (Lovable Emails)
- Requiere configurar dominio (ej. `notify.cruzdelsur.com.pe`) vía diálogo de setup.
- Template React Email "cotizacion" con branding Cruz del Sur (rojo corporativo, tipografía limpia): saludo personalizado, resumen de items, total, botón "Ver cotización" (enlace público con token), PDF adjunto o enlace de descarga.
- Diálogo "Enviar cotización":
  - To: correo del cliente (editable)
  - CC: correos libres
  - Asunto y mensaje editables con plantilla pre-rellenada
  - Checkbox "Adjuntar PDF"
- Al enviar: se registra en `email_send_log`, cambia estado a `enviada`, guarda `enviada_en` y `enviada_a`, y crea un **Seguimiento automático** en la oportunidad vinculada ("Cotización COT-… enviada a cliente@…").

### 2d. Estados y ciclo de vida
Estados: `borrador → enviada → aceptada | rechazada | vencida` (vencida automática cuando `valido_hasta < hoy` y sigue enviada).

Al marcar **aceptada**:
- Se registra fecha y usuario.
- La oportunidad vinculada pasa a `ganada` (con confirmación).
- Se pre-crean N filas en Envíos como `estimado` (una por item) con ruta, peso y precio, marcadas "Pendiente de ejecutar en Cargo" — sirve como promesa a monitorear, no reemplaza la venta.
- Se sugiere programar seguimiento post-venta a 7 días.

Al marcar **rechazada**: pide motivo (precio, tiempo, competencia, otro) para métricas.

---

## 3. Envíos — reenfoque como termómetro comercial

Aclaración visible en la cabecera del módulo: *"Las ventas reales viven en Cargo. Aquí registras promesas y seguimiento comercial para monitorear volumen y detectar caídas."*

Cambios:
- Nueva columna `origen_registro`: `manual` | `cotizacion_aceptada`.
- Nueva columna `cotizacion_id` (nullable) para trazabilidad.
- Nuevo estado inicial `estimado` (además de en_tránsito / entregado / devuelto / anulado): representa una promesa aceptada aún no operada.
- Vista global de Envíos:
  - KPIs: envíos estimados (pipeline comprometido S/), envíos ejecutados últimos 30d, ticket promedio, top 5 clientes por volumen, **clientes con caída** (comparativa últimos 30d vs 30d previos).
  - Filtros: rango de fechas, cliente, estado, ejecutivo.
- En el detalle de cliente: gráfica simple de envíos por mes (últimos 6 meses) para que el ejecutivo vea tendencia.

---

## 4. Integraciones cruzadas (concordancia entre módulos)

- **Cliente → tab "Cotizaciones"**: lista de cotizaciones del cliente con estado y total.
- **Cliente → tab "Envíos"**: ya existe, se enriquece con estimados vs ejecutados.
- **Oportunidad → sección "Cotizaciones"**: cotizaciones ligadas, botón "Nueva cotización desde esta oportunidad" (precarga cliente).
- **Cotización → link a oportunidad y cliente**.
- **Dashboard (`/`)**: agrega tarjetas "Cotizaciones enviadas esta semana", "Aceptadas mes", "Ratio aceptación", "Pipeline comprometido (envíos estimados)".
- **Asistente IA**: aprende a leer `cotizaciones`, `tarifas`, `envios`. Ej.: "¿cuál es la tarifa vigente Lima–Arequipa para Distribuidora X?", "genera un borrador de correo de seguimiento para las cotizaciones enviadas hace más de 5 días sin respuesta".

---

## 5. Roles y permisos

- **Administrador**: todo.
- **Coordinador**: gestiona tarifario, ve todas las cotizaciones.
- **Ejecutivo**: crea/edita cotizaciones de sus clientes, lee tarifario, no edita tarifas.
- RLS acorde en `tarifas`, `cotizaciones`, `cotizacion_items`, `envios`.

---

## Detalles técnicos

### Migraciones
- `tarifas` (nueva) + índices por (origen, destino, servicio, cliente_id, activo).
- `cotizaciones`: agregar `numero` (correlativo generado por secuencia), `oportunidad_id`, `correo_destino`, `correos_cc[]`, `condiciones`, `notas_internas`, `incluye_igv boolean`, `enviada_en`, `enviada_a`, `token_publico`, `motivo_rechazo`, `ejecutivo_id`.
- `cotizacion_items`: agregar `origen`, `destino`, `servicio`, `peso_kg`, `bultos`, `precio_sugerido`, `tarifa_id`.
- `envios`: agregar `cotizacion_id`, `origen_registro`, ampliar enum estado con `estimado`.
- RPC `sugerir_tarifa`, `siguiente_numero_cotizacion`.
- GRANTs + RLS en cada tabla nueva/modificada.

### Correo
- `email_domain--setup_email_infra` + diálogo `<presentation-open-email-setup>` para configurar `notify.cruzdelsur.com.pe`.
- `email_domain--scaffold_transactional_email` → plantilla `cotizacion` en `src/lib/email-templates/cotizacion.tsx`.
- Server function `enviarCotizacion({ cotizacionId, to, cc, asunto, mensaje, adjuntarPdf })` que renderiza PDF, encola envío, registra log y seguimiento.

### PDF
- React server-side render + generador PDF compatible con Worker (usa un servicio externo o librería edge-compatible; si `pdf-lib`/similar no corre en Worker, usar Cloud Print API vía fetch o generar HTML→PDF con un servicio ligero). Fallback: enlace público estilo cotización HTML si el PDF falla.

### Vista pública de cotización
- Ruta pública `/api/public/cotizacion/$token` (o página `/c/$token`) para que el cliente vea la cotización sin loguearse, con opción de aceptar/rechazar que llama endpoint firmado con token.

---

## Entregables por fase

**Fase 1 — Fundaciones**
1. Migraciones (tarifas, ampliación de cotizaciones/items/envios, RPCs).
2. Módulo Tarifario (CRUD + import CSV).
3. Configuración de dominio de correo.

**Fase 2 — Cotizaciones pro**
4. Editor con combobox cliente, items dinámicos, sugerencia de tarifa, correlativo.
5. Vista imprimible + generación PDF.
6. Envío por correo con plantilla branded + registro en seguimientos.
7. Vista pública por token con aceptar/rechazar.

**Fase 3 — Envíos como termómetro**
8. Estado `estimado`, creación automática desde cotización aceptada.
9. KPIs de pipeline y caída de clientes, gráfica por cliente.

**Fase 4 — Integraciones**
10. Tabs de cotizaciones en cliente y oportunidad.
11. Tarjetas en dashboard.
12. Extender asistente IA con las nuevas tablas.

¿Apruebo y arrancamos por Fase 1?
