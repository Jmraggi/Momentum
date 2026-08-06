# Hábitos — dashboard y constancia

## Estado y alcance

Las tres fases están implementadas: base de datos aditiva, registro diario por tipo, pausas históricas, KPIs diarios, resumen real en Inicio, seguimiento visual por período y rutinas encadenadas.

La implementación reemplaza la query monolítica por una query diaria jerárquica (`['habits', userId, 'dashboard', date]`) que carga definiciones, pausas, preferencias y el rango histórico necesario para rachas. Las mutaciones invalidan la raíz de Hábitos para mantener sincronizados Inicio y el módulo.

## Modelo y reglas

- `habits` incorpora `habit_type` (`build`/`break`), `tracking_type` (`binary`/`count`/`duration`/`quantitative`), franja horaria, valor objetivo, unidad y mínimo de éxito. `target_count` se mantiene por compatibilidad y se replica al backfill.
- `habit_entries` incorpora valor, estado y motivo de omisión. Los estados distinguen completado/parcial de evitado/ocurrencia.
- `habit_pause_periods` conserva la historia de pausas; esos días no son oportunidades y no alteran porcentajes ni rachas. `habit_preferences` guarda el umbral de racha general, inicializado en 80%.
- La puntuación del día es `100 × suma del progreso / hábitos aplicables`, únicamente para hábitos diarios o por días específicos. Los parciales son proporcionales; los binarios son 0 o 1.
- Un hábito `break` tiene éxito solo con `avoided`; una ocurrencia registrada no suma progreso. La acción principal declara que se evitó.
- Las metas `weekly_count` muestran avance semanal y se excluyen de la puntuación diaria. Se marcan en riesgo cuando la meta excede los días restantes posibles.
- Rachas individuales cuentan ocurrencias programadas exitosas. La racha general encadena días con puntuación igual o superior al umbral; los días sin oportunidades se omiten.

## Interfaz

- Escritorio y móvil priorizan los KPIs, el registro rápido y las secciones Mañana, Tarde, Noche, Antes de dormir y En cualquier momento.
- Cada tarjeta de hábito adapta su acción a tipo y registro, muestra progreso y racha, y permite pausar/reactivar.
- Inicio muestra completados, total aplicable y puntuación real en la tarjeta y panel de Hábitos.

## Fases siguientes

Las rutinas usan `habit_routines` y `habit_routine_items`: pueden incluir hábitos existentes en un orden explícito, guardar un disparador en el primer paso y pausar o eliminar la rutina sin modificar los hábitos. Su progreso diario se calcula desde las mismas entradas de hábitos.

El seguimiento implementado incorpora mapa de calor mensual de intensidad, matriz por hábito para la semana en curso, promedio anual por mes, días activos y nivel descriptivo de consistencia sobre las últimas 28 oportunidades disponibles.

Fuera de alcance: recordatorios, notificaciones, automatizaciones, tareas automáticas, grupos personalizados, hitos persistentes, integración con Salud y eliminación destructiva de columnas heredadas.
