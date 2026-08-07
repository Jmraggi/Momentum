# Importación asistida de resúmenes financieros

## Alcance implementado

La importación es local y asistida: Momentum genera un prompt con las categorías reales, el usuario usa ChatGPT por su cuenta y luego pega o sube un JSON. No hay API de OpenAI ni se envían documentos desde Momentum.

El modal guía configuración, prompt, carga de JSON, validación, revisión y confirmación. No se insertan movimientos hasta la confirmación explícita del lote.

## JSON v2

La versión requerida es `momentum.finance_statement.v2`. El objeto raíz contiene exactamente `schema_version` y `statements`; cada resumen detectado incluye institución, cuenta/tarjeta, tipo, moneda, período y movimientos. Cada movimiento exige fecha ISO, descripciones, `amount` positivo como string con hasta dos decimales, tipo, categoría sugerida nullable, confianza, motivo de revisión, cuotas y señales de duplicado/reintegro.

El parser rechaza claves desconocidas, tipos inválidos, importes de punto flotante, moneda inválida, períodos inválidos y JSON mayor de 2 MB. Los importes se convierten a `amount_minor` mediante operaciones con strings. La cuenta, la moneda y el período se detectan primero y se mapean durante la revisión.

## Persistencia y seguridad

- `finance_import_batches` conserva el JSON, su hash, período, cuenta, moneda, estado y trazabilidad.
- `finance_import_batch_items` guarda cada fila revisable antes de insertarla.
- `finance_transactions` conserva origen, descripciones, identificadores, hash y metadatos de revisión.
- `finance_expense_groups` y `finance_expense_group_items` modelan gasto original, reintegro y ajuste sin borrar movimientos bancarios.
- RLS y triggers verifican propiedad, moneda, categoría y roles. La RPC `confirm_finance_import_batch` inserta en una única transacción.

## Deduplicación y reintegros

Los identificadores externos son únicos por cuenta; la huella SHA-256 de cada movimiento evita repeticiones internas y los candidatos se comparan por cuenta, tipo, importe, fecha cercana y descripción normalizada. Un candidato debe resolverse manualmente como conservar o excluir.

Un reintegro se importa como ingreso y puede asociarse a un grupo de gasto. El grupo calcula costo neto sin modificar los montos bancarios brutos. La pantalla actual deja preparada la persistencia y la señalización; el editor completo de grupos y reportes netos avanzados queda para la siguiente iteración.

## Límites deliberados

No hay conversión de moneda, OCR, CSV, carga de PDF/imagen, creación automática de categorías, conciliación bancaria ni reversión de un lote ya confirmado. Un lote cancelado conserva trazabilidad y se puede reabrir sin duplicar movimientos.
