# Proyectos: pilar visual de ejecución

## Alcance implementado

La primera fase convierte Proyectos en una vista operativa sin duplicar tareas. Incorpora KPIs reales, una siguiente acción prioritaria, progreso por tareas, Kanban y la misma fuente de tareas que Prioridades.

## Reglas

- El progreso por tareas es `tareas completadas válidas / tareas válidas`; las canceladas no cuentan y un proyecto sin tareas muestra “Sin tareas”.
- La tasa general considera únicamente proyectos activos y es `tareas completadas válidas / tareas válidas de proyectos activos`.
- La siguiente acción sólo considera tareas pendientes o en curso de proyectos activos. Orden: Eisenhower, vencimiento, programación, orden manual y creación.
- Los proyectos pausados no producen alertas, siguiente acción ni afectan la tasa de avance.
- Hitos, sesiones de trabajo, racha de enfoque, bitácora, ideas, recursos y habilidades quedan para fases posteriores. No se calculan rachas sin sesiones reales.

## Datos incorporados

- `projects.completed_at` permite contar proyectos completados dentro del mes calendario.
- `tasks` conserva su rol transversal y agrega flujo Kanban mediante `status`, además de `manual_order`, `start_at`, `energy_required` y `focus_mode`.
- La migración valida que una tarea vinculada a un proyecto pertenezca al mismo usuario.

## Próximas fases

1. Hitos y línea de tiempo, con progreso separado y ponderado por hitos.
2. Sesiones reales y bitácora manual de avances, victorias y aprendizajes.
3. Incubadora de ideas, recursos y habilidades asociadas.
