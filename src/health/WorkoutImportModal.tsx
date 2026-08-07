import { useMemo, useState } from 'react'
import type { Workout, WorkoutInput } from './workoutData'

const activityTypes = ['crossfit', 'strength', 'running', 'walking', 'cycling', 'mobility', 'sport', 'other'] as const
type ActivityType = typeof activityTypes[number]
type ImportRow = WorkoutInput & { id: string; included: boolean; duplicate: boolean }
const activityAliases: Record<string, ActivityType> = { fuerza: 'strength', pesas: 'strength', gimnasio: 'strength', correr: 'running', carrera: 'running', caminata: 'walking', bici: 'cycling', ciclismo: 'cycling', movilidad: 'mobility', deporte: 'sport', otro: 'other' }

const prompt = `Convertí el historial de entrenamientos que voy a compartir en JSON estricto. No uses Markdown, explicaciones ni texto antes o después del JSON. No inventes datos: si falta un dato usá null cuando el esquema lo permita.

Devolvé exactamente este formato:
{
  "schema_version": "momentum.workouts.v1",
  "workouts": [
    {
      "title": "Entrenamiento de fuerza",
      "activity_type": "strength",
      "started_at": "2026-08-07T18:30:00-03:00",
      "duration_minutes": 60,
      "perceived_exertion": 7,
      "notes": "Sentadillas y press"
    }
  ]
}

Reglas: activity_type debe ser crossfit, strength, running, walking, cycling, mobility, sport u other. started_at debe ser ISO 8601 completo. duration_minutes es un entero de 1 a 1440. perceived_exertion es entero de 1 a 10 o null. notes puede ser texto o null.`

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const durationMinutes = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return Number.NaN
  const text = value.trim().toLocaleLowerCase(); if (/^\d+$/.test(text)) return Number(text)
  const clock = text.match(/^(\d{1,2}):(\d{2})$/); if (clock) return Number(clock[1]) * 60 + Number(clock[2])
  const words = text.match(/^(?:(\d+)\s*(?:h|hora|horas)\s*)?(?:(\d+)\s*(?:m|min|mins|minuto|minutos)?)?$/); if (words && (words[1] || words[2])) return Number(words[1] ?? 0) * 60 + Number(words[2] ?? 0)
  return Number.NaN
}

function parse(raw: string, existing: Workout[]): ImportRow[] {
  let payload: unknown
  try { payload = JSON.parse(raw) } catch { throw new Error('El texto no es JSON válido.') }
  if (!isRecord(payload) || payload.schema_version !== 'momentum.workouts.v1' || !Array.isArray(payload.workouts)) throw new Error('Se esperaba schema_version "momentum.workouts.v1" y una lista workouts.')
  return payload.workouts.map((value, index) => {
    if (!isRecord(value)) throw new Error(`Entrenamiento ${index + 1}: formato inválido.`)
    const title = textValue(value.title); const rawActivity = textValue(value.activity_type).toLocaleLowerCase(); const activity = activityAliases[rawActivity] ?? rawActivity; const started = textValue(value.started_at); const duration = durationMinutes(value.duration_minutes ?? value.duration); const rawRpe = value.perceived_exertion ?? null; const rpe = typeof rawRpe === 'number' ? rawRpe : null; const rawNotes = value.notes ?? null; const notes = typeof rawNotes === 'string' ? rawNotes : null
    const problems: string[] = []
    if (!title) problems.push('título')
    if (!activityTypes.includes(activity as ActivityType)) problems.push('tipo')
    if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < 1 || duration > 1440) problems.push('duración (entero entre 1 y 1440)')
    if (Number.isNaN(new Date(started).getTime())) problems.push('fecha ISO')
    if (rawRpe !== null && (typeof rawRpe !== 'number' || !Number.isInteger(rawRpe) || rawRpe < 1 || rawRpe > 10)) problems.push('RPE (1 a 10 o null)')
    if (typeof rawNotes !== 'string' && rawNotes !== null) problems.push('notas (texto o null)')
    if (problems.length) throw new Error(`Entrenamiento ${index + 1}: ${problems.join(', ')}.`)
    const startedAt = new Date(started).toISOString(); const duplicate = existing.some((item) => item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase() && item.duration_minutes === duration && new Date(item.started_at).getTime() === new Date(startedAt).getTime())
    return { id: `${index}-${title}`, included: !duplicate, duplicate, title, activity_type: activity, started_at: startedAt, duration_minutes: duration, perceived_exertion: rpe, notes: notes?.trim() || null }
  })
}

export function WorkoutImportModal({ existing, onClose, onImport }: { existing: Workout[]; onClose: () => void; onImport: (rows: WorkoutInput[]) => Promise<void> }) {
  const [raw, setRaw] = useState(''); const [rows, setRows] = useState<ImportRow[]>([]); const [error, setError] = useState(''); const [copyState, setCopyState] = useState(''); const [saving, setSaving] = useState(false)
  const included = useMemo(() => rows.filter((row) => row.included), [rows])
  const analyze = () => { try { setRows(parse(raw, existing)); setError('') } catch (reason) { setRows([]); setError(reason instanceof Error ? reason.message : 'No se pudo analizar el JSON.') } }
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); setCopyState('Prompt copiado.') } catch { setCopyState('No se pudo copiar automáticamente. Copialo desde el cuadro.') } }
  const confirm = async () => { if (!included.length) return; setSaving(true); try { await onImport(included.map((row) => ({ title: row.title, activity_type: row.activity_type, started_at: row.started_at, duration_minutes: row.duration_minutes, perceived_exertion: row.perceived_exertion, notes: row.notes }))); onClose() } catch { setError('No se pudieron guardar los entrenamientos.') } finally { setSaving(false) } }
  return <div className="home-modal-backdrop" role="presentation"><section aria-labelledby="workout-import-title" aria-modal="true" className="home-modal workout-import-modal" role="dialog"><div className="task-form"><div className="task-form-heading"><div><p className="eyebrow">Importación asistida</p><h2 id="workout-import-title">Importar entrenamientos</h2></div><button className="text-button" onClick={onClose} type="button">Cerrar</button></div><p>ChatGPT se usa fuera de Momentum. Copiá el prompt, compartilo con tu chat y pegá únicamente el JSON resultante.</p><textarea aria-label="Prompt para ChatGPT" className="workout-import-prompt" readOnly value={prompt} /><div className="task-form-actions"><button className="secondary-button" onClick={copy} type="button">Copiar prompt</button>{copyState && <span className="form-hint">{copyState}</span>}</div><label>JSON devuelto por ChatGPT<textarea onChange={(event) => setRaw(event.target.value)} placeholder='{ "schema_version": "momentum.workouts.v1", "workouts": [] }' value={raw} /></label><button className="secondary-button" disabled={!raw.trim()} onClick={analyze} type="button">Analizar JSON</button>{error && <p className="form-error">{error}</p>}{rows.length > 0 && <><div className="workout-import-summary"><strong>{included.length} entrenamiento{included.length === 1 ? '' : 's'} listo{included.length === 1 ? '' : 's'} para importar</strong><span>Revisá y excluí las filas que no quieras incorporar.</span></div><div className="workout-import-list">{rows.map((row, index) => <label className="workout-import-row" key={row.id}><input checked={row.included} onChange={() => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, included: !item.included } : item))} type="checkbox" /><span><strong>{row.title}</strong><small>{new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.started_at))} · {row.activity_type} · {row.duration_minutes} min{row.perceived_exertion ? ` · RPE ${row.perceived_exertion}` : ''}</small>{row.duplicate && <em>Posible duplicado: queda excluido por defecto.</em>}</span></label>)}</div><div className="task-form-actions"><button className="secondary-button" onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={!included.length || saving} onClick={confirm} type="button">Confirmar importación</button></div></>}</div></section></div>
}
