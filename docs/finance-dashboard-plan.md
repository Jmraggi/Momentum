# Dashboard de Finanzas — Fase 1

Esta implementación cubre flujo de dinero, control del gasto y presupuestos mensuales por categoría en ARS. Los importes se guardan como unidades menores enteras. El saldo total muestra solo cuentas operativas; ahorro, patrimonio, tarjetas e inversiones quedan como capacidades futuras.

## Reglas

- Los movimientos pendientes se muestran, pero no modifican saldos, ingresos, gastos ni presupuestos.
- El disponible diario es el remanente de los presupuestos de categoría dividido por los días restantes, incluido el actual.
- El patrimonio neto queda no disponible hasta incorporar activos y pasivos; no se deduce de cuentas de efectivo.
- Transferencias, vencimientos, ahorro, tarjetas, inversiones e integraciones externas no forman parte de esta fase.

## Datos incorporados

- `finance_transactions.amount_minor bigint` sustituye el importe decimal.
- Las cuentas incorporan saldo y fecha inicial, además de su rol de balance.
- Presupuestos: `finance_budget_periods` y `finance_budget_allocations`.
- Preferencias de privacidad: `finance_preferences.hide_amounts`.
