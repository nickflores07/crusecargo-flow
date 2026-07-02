## Etapa 4 — Historial de envíos y Cotizaciones

Manteniendo todo lo corregido en etapas 1–3 (rótulos "Institucional/Común", filtros, canal, ejecutivos, oportunidades kanban, etc.), agrego las dos piezas que faltan del núcleo comercial.

### 1. Base de datos (una sola migración)

**Tabla `envios`** (historial de envíos por cliente, alimenta el dashboard):
- cliente_id, ejecutivo_id, fecha, servicio, origen, destino, peso_kg, bultos, guia (número), importe, estado (`en_transito`, `entregado`, `devuelto`, `anulado`), notas
- Índice por (cliente_id, fecha desc) para historial rápido
- RLS heredada del cliente: el ejecutivo ve solo envíos de sus clientes; supervisor/admin ven todo
- GRANT a `authenticated` y `service_role`
- Trigger `set_updated_at`

**Tabla `cotizaciones`**:
- cliente_id, ejecutivo_id, numero (correlativo texto), fecha_emision, fecha_vencimiento, estado (`borrador`, `enviada`, `pendiente`, `aceptada`, `rechazada`, `vencida`), moneda (default PEN), subtotal, igv, total, notas
- Misma RLS heredada + GRANT + trigger

**Tabla `cotizacion_items`**:
- cotizacion_id (FK cascade), descripcion, cantidad, precio_unit, importe
- RLS: acceso condicionado a acceso a la cotización padre

### 2. Ficha del cliente — nuevas pestañas

En `/clientes/$id` (que ya tiene tabs Resumen · Contactos · Seguimiento · Oportunidades), agrego:

- **Historial de envíos**: tabla con fecha, servicio, origen→destino, peso, bultos, importe, estado (badge). Botón "Registrar envío" abre diálogo con el formulario. Totalizador arriba (nº envíos, peso total, facturación acumulada del cliente).
- **Cotizaciones**: lista tipo tarjeta con número, fecha, total, estado (badge de color) y vencimiento. Botón "Nueva cotización" abre editor con ítems dinámicos (agregar/quitar filas, cálculo automático de subtotal / IGV 18% / total). Cada cotización se puede marcar como Enviada / Aceptada / Rechazada desde la lista.

### 3. Navegación

- Sin nuevas rutas de nivel superior por ahora — todo vive dentro de la ficha del cliente, como pide el prompt original.
- Los datos de envíos ya quedan listos para alimentar el Dashboard en la Etapa 5.

### Detalles técnicos

- Estados como enums Postgres (`envio_estado`, `cotizacion_estado`) para consistencia con el resto del proyecto.
- RLS de envíos/cotizaciones usa `EXISTS (SELECT 1 FROM clientes WHERE id = cliente_id AND (ejecutivo_id = auth.uid() OR has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'supervisor')))` — mismo patrón que ya usan las oportunidades.
- Número de cotización: generado en cliente como `COT-YYYYMM-XXXX` con secuencia por año-mes calculada al vuelo (simple, sin secuencia SQL para no complicar).
- PDF descargable de cotización: lo dejo pendiente para el final de esta etapa como mejora opcional una vez validado el flujo — te aviso antes de agregarlo. Todo lo demás (crear, listar, editar estado, ítems) queda operativo.

### Orden

1. Migración BD (envios, cotizaciones, cotizacion_items + RLS + GRANT + triggers).
2. Pestaña "Historial de envíos" con formulario y totalizador.
3. Pestaña "Cotizaciones" con editor de ítems y cambio de estado inline.

¿Avanzo con la migración?
