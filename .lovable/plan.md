## Objetivo
Unificar el flujo **Prospección → Actividad → Agenda** para que ninguna actividad (visita, llamada, reunión, WhatsApp, Teams) exista suelta: toda actividad nace de una prospección y se refleja automáticamente en Plan Semanal y Mi Día.

## Diagnóstico actual
- **Plan Semanal** permite crear actividades sueltas ("Nueva actividad" y botón `+` por día) sin vincular a una prospección. Eso duplica el registro de contactos y rompe la trazabilidad.
- **Prospecciones** sólo permite "Registrar contacto" (histórico) pero no *programar* la próxima reunión/visita con fecha y hora.
- **Mi Día** ya consolida ambos, pero como las fuentes están desconectadas, se ve desordenado.

## Cambios propuestos

### 1. Plan Semanal se vuelve una vista (no un creador)
- Quitar el botón **"+ Nueva actividad"** de la cabecera.
- Quitar los botones **`+`** de cada tarjeta de día.
- La grilla semanal queda como vista de solo-lectura + acciones sobre lo existente (marcar realizada, reprogramar, cancelar, registrar logro).
- Cada tarjeta de actividad muestra el **prospecto de origen** con enlace directo a su ficha.
- Se agrega un enlace visible: *"¿Falta algo? Prográmalo desde una prospección →"* que lleva al módulo Prospecciones.

### 2. Prospecciones se vuelve el único punto de creación de actividades
- En cada tarjeta del Kanban, junto a "Registrar contacto", añadir **"Programar actividad"**.
- Nuevo diálogo `ProgramarActividadDialog` con: tipo (visita, llamada, reunión presencial, reunión Teams, WhatsApp, otro), fecha, hora, motivo, ciudad (autollena del cliente).
- Al guardar: crea fila en `visitas_planificadas` con `oportunidad_id` vinculado + actualiza `proxima_accion_fecha` de la prospección.
- La tarjeta del Kanban muestra la **próxima actividad programada** (badge con fecha/hora y tipo) además del último contacto.
- Al marcar una actividad como realizada desde Plan Semanal o Mi Día, se registra automáticamente como `seguimiento` de esa prospección (cierre del ciclo).

### 3. Mi Día refleja el mismo flujo
- Las actividades vencidas / hoy / próximas siguen viniendo de `visitas_planificadas`, pero cada tarjeta ahora enlaza al **prospecto** de origen (no sólo al cliente).
- Se agrega un botón secundario **"Ver prospección"** en cada actividad.

### 4. Base de datos
- Migración: agregar columna `oportunidad_id uuid references oportunidades(id) on delete cascade` a `visitas_planificadas` (nullable para no romper histórico).
- Índice sobre `oportunidad_id` para consultas rápidas desde el Kanban.
- Ampliar el enum/CHECK de `tipo` para incluir `reunion_teams` si no existe.

## Detalles técnicos (para quien implementa)
- **Archivos a editar:**
  - `src/routes/_authenticated/rutas.tsx` — quitar botones de creación, mostrar vínculo a prospecto, mantener acciones de estado.
  - `src/routes/_authenticated/oportunidades.tsx` — nuevo botón "Programar actividad", mostrar próxima actividad.
  - `src/routes/_authenticated/mi-dia.tsx` — enlace a prospecto en cada tarjeta.
- **Archivos nuevos:**
  - `src/components/prospecciones/programar-actividad-dialog.tsx`.
- **Migración SQL:** `ALTER TABLE visitas_planificadas ADD COLUMN oportunidad_id UUID REFERENCES oportunidades(id) ON DELETE CASCADE;` + índice + actualización del CHECK de `tipo`.
- **Regla de negocio:** al completar una actividad → INSERT en `seguimientos` con `oportunidad_id`, `resultado = logro`, y actualiza `ultimo_contacto_en` del cliente.

## Resultado esperado
El ejecutivo sólo piensa en **prospecciones**. Desde ahí programa qué hacer y cuándo. Plan Semanal y Mi Día son *vistas* de esa realidad, no repositorios paralelos. Supervisión clara y sin datos duplicados.
