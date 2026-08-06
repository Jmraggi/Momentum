# Dashboard de Salud

## Alcance implementado

El dashboard reúne estado actual, tendencias, entrenamiento y recuperación sin mezclar hábitos ni tareas. Incluye KPIs de peso, entrenamiento, sueño, energía, agua y pasos; tendencias de peso, sueño, energía y minutos; heatmap de actividad y anillos de completitud.

## Datos y privacidad

Agua y pasos usan las métricas diarias existentes. Las nuevas tablas `health_settings`, `exercises`, `workout_exercises` y `workout_sets` quedan aisladas por usuario mediante RLS. El readiness es opcional, se calcula en el cliente y expone su fórmula: 30% duración de sueño, 25% calidad, 25% energía y 20% fatiga invertida. No es una recomendación médica.

## Fuera de alcance

Zonas cardíacas, wearables, sincronización externa, recomendaciones médicas y predicciones quedan pendientes de definir proveedor, consentimiento y política de retención.

## Defaults

Las metas iniciales son 2.000 ml de agua y 8.000 pasos. Se podrán personalizar mediante `health_settings`.
