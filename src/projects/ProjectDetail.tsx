import { CirclePause, CirclePlay, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { type Task, useTaskMutations } from '../tasks/tasks'
import { isProjectTask, nextProjectAction, projectProgress, useProjectMutations, useProjectsWorkspace } from './projects'

type Form = { title: string; urgent: boolean; important: boolean; due: string; duration: string }
const initial: Form = { title: '', urgent: false, important: false, due: '', duration: '' }
const columns = [{ status: 'pending', title: 'Pendiente' }, { status: 'in_progress', title: 'En curso' }, { status: 'blocked', title: 'En espera' }, { status: 'completed', title: 'Hecha' }] as const

export function ProjectDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth(); const month = new Date().toISOString().slice(0, 7)
  const workspace = useProjectsWorkspace(user?.id, month); const projects = useProjectMutations(user?.id); const tasks = useTaskMutations(user?.id); const [open, setOpen] = useState(false)
  if (workspace.isLoading) return <div className="page"><div className="tasks-state">Cargando proyecto…</div></div>
  if (workspace.error || !workspace.data || !workspace.tasks.data) return <div className="page"><div className="tasks-state tasks-state--error">No se pudo cargar el proyecto.</div></div>
  const fallback = workspace.projects.find((item) => item.id === id)
  if (!fallback) return <div className="page"><div className="tasks-state">Proyecto no encontrado.</div></div>
  const own = workspace.tasks.data.filter((task) => isProjectTask(task, fallback.id)); const progress = projectProgress(fallback, own); const next = nextProjectAction(workspace.projects, workspace.tasks.data, fallback.id)
  return <div className="page project-detail"><header className="page-header"><div><p className="eyebrow">Proyecto</p><h1>{fallback.name}</h1><p className="page-description">{progress.percent === null ? 'Sin tareas' : `${progress.percent.toFixed(0)}% por tareas`} · {fallback.due_date ?? 'Sin fecha límite'}</p></div><div className="project-header-actions"><button className="secondary-button" onClick={() => projects.setStatus.mutate({ id: fallback.id, status: fallback.status === 'paused' ? 'active' : 'paused' })} type="button">{fallback.status === 'paused' ? <CirclePlay size={17} /> : <CirclePause size={17} />}{fallback.status === 'paused' ? 'Reanudar' : 'Pausar'}</button><button className="primary-button" onClick={() => setOpen(true)} type="button"><Plus size={18} />Nueva tarea</button></div></header>
    {open && <TaskForm onCancel={() => setOpen(false)} onSave={async (input) => { await tasks.createTask.mutateAsync({ title: input.title.trim(), description: null, pillar: 'projects', linkedEntityType: 'project', linkedEntityId: id!, is_urgent: input.urgent, is_important: input.important, due_at: input.due ? new Date(input.due).toISOString() : null, scheduled_at: null, start_at: null, estimated_duration_minutes: input.duration ? Number(input.duration) : null, energy_required: null, focus_mode: null }); setOpen(false) }} />}
    <section className="project-focus-card"><div><p className="eyebrow">Siguiente acción</p><h2>{next?.task.title ?? 'No hay una acción elegible'}</h2><p>{next ? `${next.reason}. Regla: Eisenhower, vencimiento, programación, orden y creación.` : fallback.status === 'paused' ? 'El proyecto está pausado y no genera acciones.' : 'Creá o activá una tarea para continuar.'}</p></div>{next && <button className="secondary-button" onClick={() => tasks.setTaskStatus.mutate({ id: next.task.id, status: 'in_progress' })} type="button">Empezar</button>}</section>
    <section className="project-board" aria-label="Tablero Kanban del proyecto">{columns.map((column) => <KanbanColumn key={column.status} title={column.title} tasks={own.filter((task) => task.status === column.status).sort((a, b) => a.manual_order - b.manual_order || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())} onMove={(task, delta) => tasks.moveTask.mutate({ task, delta })} onStatus={(task, status) => tasks.setTaskStatus.mutate({ id: task.id, status })} />)}</section>
    <button className="text-button" onClick={() => nav('/proyectos')} type="button">Volver a proyectos</button>
  </div>
}

function KanbanColumn({ title, tasks, onStatus, onMove }: { title: string; tasks: Task[]; onStatus: (task: Task, status: string) => void; onMove: (task: Task, delta: number) => void }) {
  return <section className="project-kanban-column"><h2>{title} <span>{tasks.length}</span></h2><div>{tasks.length ? tasks.map((task) => <article className="project-task-card" key={task.id}><strong>{task.title}</strong><small>{task.is_important ? 'Importante' : 'Normal'}{task.due_at ? ` · ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(task.due_at))}` : ''}</small><div className="project-task-actions"><button aria-label={`Subir ${task.title}`} onClick={() => onMove(task, -1)} type="button">↑</button><button aria-label={`Bajar ${task.title}`} onClick={() => onMove(task, 1)} type="button">↓</button></div><select aria-label={`Cambiar estado de ${task.title}`} onChange={(event) => onStatus(task, event.target.value)} value={task.status}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="blocked">En espera</option><option value="completed">Hecha</option></select></article>) : <p>Sin tareas</p>}</div></section>
}

function TaskForm({ onCancel, onSave }: { onCancel: () => void; onSave: (input: Form) => Promise<void> }) {
  const [form, setForm] = useState(initial)
  const submit = async (event: FormEvent) => { event.preventDefault(); await onSave(form) }
  return <form className="task-form" onSubmit={submit}><label>Título<input onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label><div className="task-form-grid"><label>Fecha límite<input onChange={(event) => setForm({ ...form, due: event.target.value })} type="datetime-local" value={form.due} /></label><label>Duración estimada<input min="1" onChange={(event) => setForm({ ...form, duration: event.target.value })} type="number" value={form.duration} /></label></div><div className="task-checks"><label><input checked={form.urgent} onChange={(event) => setForm({ ...form, urgent: event.target.checked })} type="checkbox" />Urgente</label><label><input checked={form.important} onChange={(event) => setForm({ ...form, important: event.target.checked })} type="checkbox" />Importante</label></div><div className="task-form-actions"><button className="secondary-button" onClick={onCancel} type="button">Cancelar</button><button className="primary-button" type="submit">Guardar tarea</button></div></form>
}
