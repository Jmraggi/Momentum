# Prioridades: matriz Eisenhower transversal y ágil

## Alcance implementado

- `tasks` se mantiene como única fuente transversal: el cuadrante se deriva de `is_urgent` e `is_important`; no se persiste ni duplica.
- La matriz de `/prioridades` incorpora ejes, filtros por pilar/estado, tareas de proyectos activos, contadores, alta contextual, edición, completado, eliminación y movimiento entre cuadrantes.
- Inicio usa las mismas reglas de selección para su widget compacto y Proyectos crea tareas mediante la capa común de mutaciones.

## Reglas

- Activas incluye `pending`, `in_progress` y `blocked`; vencidas son activas con fecha límite pasada; canceladas no se muestran.
- Por defecto sólo se muestran tareas manuales y tareas de proyectos activos. El control explícito permite incluir proyectos pausados.
- Los filtros son vistas derivadas en cliente y no crean ni modifican registros.
- El orden dentro de los cuadrantes es vencimiento, fecha límite, programación, orden manual y creación.

## Accesibilidad y responsive

- Escritorio/tablet mantiene matriz 2×2 con drag & drop por mouse y teclado.
- Móvil muestra una pestaña de cuadrante a la vez y cada tarea dispone de un selector “Mover a…”, sin requerir arrastre táctil.
- Títulos, descripciones, contadores, iconos, foco visible y anuncios `aria-live` no dependen del color.

## Datos y caché

- La mutación de cuadrante actualiza sólo `is_urgent` e `is_important`, aplica actualización optimista, restaura el snapshot ante error y luego invalida las keys de tareas y proyectos.
- No se requieren migraciones ni campos adicionales en este sprint.
