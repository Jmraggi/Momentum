import { ArrowUpRight, Clock3 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { getActiveTasksForQuadrant, taskQuadrants, useTasks } from './tasks'

export function EisenhowerWidget() {
  const { user } = useAuth()
  const { data: tasks = [], error, isLoading } = useTasks(user?.id)
  return <section className="dashboard-eisenhower" aria-labelledby="eisenhower-title"><div className="section-heading"><div><p className="eyebrow">Prioridades</p><h2 id="eisenhower-title">Matriz de Eisenhower</h2></div><NavLink className="text-button" to="/prioridades">Ver matriz completa <ArrowUpRight size={16} /></NavLink></div>{isLoading ? <div className="tasks-state">Cargando tareas…</div> : error ? <div className="tasks-state tasks-state--error">No se pudieron cargar las tareas.</div> : <div className="dashboard-priority-grid">{taskQuadrants.map((quadrant) => { const activeTasks = getActiveTasksForQuadrant(tasks, quadrant.match); return <article className={`dashboard-quadrant priority-quadrant--${quadrant.tone}`} key={quadrant.title}><div><p>{quadrant.description}</p><h3>{quadrant.title}</h3><strong>{activeTasks.length} activas</strong></div>{activeTasks.length === 0 ? <div className="dashboard-priority-empty"><Clock3 size={16} />Sin tareas</div> : <ul>{activeTasks.slice(0, 3).map((task) => <li key={task.id}><NavLink to="/prioridades">{task.title}</NavLink></li>)}</ul>}</article> })}</div>}</section>
}
