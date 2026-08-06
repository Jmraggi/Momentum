import { ArrowUpRight, Clock3 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useProjects } from '../projects/projects'
import { filterPriorityTasks, isTaskInQuadrant, taskQuadrants, useTasks } from './tasks'

export function EisenhowerWidget() {
  const { user } = useAuth(); const tasks = useTasks(user?.id); const projects = useProjects(user?.id)
  const activeTasks = filterPriorityTasks(tasks.data ?? [], projects.data ?? [], { pillar: 'all', state: 'active', includePausedProjects: false })
  return <section className="dashboard-eisenhower" aria-labelledby="eisenhower-title"><div className="section-heading"><div><p className="eyebrow">Prioridades</p><h2 id="eisenhower-title">Matriz de Eisenhower</h2></div><NavLink className="text-button" to="/prioridades">Ver matriz completa <ArrowUpRight size={16} /></NavLink></div>{tasks.isLoading || projects.isLoading ? <div className="tasks-state">Cargando tareas…</div> : tasks.error || projects.error ? <div className="tasks-state tasks-state--error">No se pudieron cargar las tareas.</div> : <div className="dashboard-priority-grid">{taskQuadrants.map((quadrant) => { const quadrantTasks = activeTasks.filter((task) => isTaskInQuadrant(task, quadrant)); return <article className={`dashboard-quadrant priority-quadrant--${quadrant.tone}`} key={quadrant.title}><div><p>{quadrant.description}</p><h3>{quadrant.title}</h3><strong>{quadrantTasks.length} activas</strong></div>{quadrantTasks.length === 0 ? <div className="dashboard-priority-empty"><Clock3 size={16} />Sin tareas</div> : <ul>{quadrantTasks.slice(0, 3).map((task) => <li key={task.id}><NavLink to="/prioridades">{task.title}</NavLink></li>)}</ul>}</article> })}</div>}</section>
}
