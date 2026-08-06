# Inicio como torre de control diaria

Implementado como una vista transversal basada en fuentes de datos de cada pilar. Inicio compone queries y mutaciones existentes, agrega un foco persistente por usuario y fecha, y evita puntajes globales opacos.

## Alcance

- Saludo diario con `profiles.display_name` opcional.
- Foco del Día explícito, persistido en `daily_focuses`, con sugerencias transparentes desde “Hacer ahora”.
- Widgets compactos de Salud, Hábitos, Proyectos/Prioridades y Finanzas.
- Acciones rápidas que abren los formularios ya existentes de los módulos.
- Heatmap de 12 semanas con cuatro segmentos por día: Salud, Hábitos, Prioridades y Finanzas. Sólo Hábitos expresa cumplimiento; los demás indican actividad registrada.

## Límites

No se incorporan vencimientos financieros, inversiones, patrimonio, wearables, datos simulados, puntaje global, automatizaciones ni personalización persistida de widgets.

## Datos nuevos

La migración `20260806150000_add_home_dashboard.sql` agrega `profiles.display_name` y `daily_focuses`, ambos protegidos por RLS.
