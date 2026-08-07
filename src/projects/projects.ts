import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { taskKeys, useTasks, type Task } from '../tasks/tasks'

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInput = Pick<Project, 'name' | 'description' | 'status' | 'priority' | 'start_date' | 'due_date'>
export const projectKeys = {
  all: (userId: string) => ['projects', userId] as const,
  list: (userId: string) => ['projects', userId, 'list'] as const,
  detail: (userId: string, projectId: string) => ['projects', userId, 'detail', projectId] as const,
  dashboard: (userId: string, month: string) => ['projects', userId, 'dashboard', month] as const,
}
const need = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Sin respuesta.')
  return result.data
}

export function useProjects(userId: string | undefined) {
  return useQuery({ queryKey: projectKeys.list(userId ?? ''), enabled: Boolean(userId), queryFn: async () => need(await supabase.from('projects').select('*').eq('user_id', userId!).order('created_at', { ascending: false })) })
}

export function isProjectTask(task: Task, projectId: string) { return task.linked_entity_type === 'project' && task.linked_entity_id === projectId }
export function validProjectTasks(projectId: string, tasks: Task[]) { return tasks.filter((task) => isProjectTask(task, projectId) && task.status !== 'cancelled') }
export function projectProgress(project: Project, tasks: Task[]) {
  const valid = validProjectTasks(project.id, tasks)
  const completed = valid.filter((task) => task.status === 'completed').length
  return { total: valid.length, completed, percent: valid.length ? completed / valid.length * 100 : null }
}

type NextAction = { task: Task; reason: string } | null
const quadrantWeight = (task: Task) => task.is_important && task.is_urgent ? 4 : task.is_important ? 3 : task.is_urgent ? 2 : 1
const dueWeight = (task: Task, now: number) => !task.due_at ? Number.POSITIVE_INFINITY : Math.max(0, new Date(task.due_at).getTime() - now)
const scheduledWeight = (task: Task) => task.scheduled_at ? new Date(task.scheduled_at).getTime() : Number.POSITIVE_INFINITY
export function nextProjectAction(projects: Project[], tasks: Task[], projectId?: string): NextAction {
  const activeIds = new Set(projects.filter((project) => project.status === 'active' && (!projectId || project.id === projectId)).map((project) => project.id))
  const eligible = tasks.filter((task) => task.linked_entity_type === 'project' && task.linked_entity_id && activeIds.has(task.linked_entity_id) && (task.status === 'pending' || task.status === 'in_progress'))
  if (!eligible.length) return null
  const now = Date.now()
  const sorted = [...eligible].sort((a, b) => quadrantWeight(b) - quadrantWeight(a) || dueWeight(a, now) - dueWeight(b, now) || scheduledWeight(a) - scheduledWeight(b) || a.manual_order - b.manual_order || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const task = sorted[0]
  const reason = task.is_important && task.is_urgent ? 'Urgente e importante' : task.is_important ? 'Importante' : task.is_urgent ? 'Urgente' : 'Orden de ejecución'
  return { task, reason: task.due_at && new Date(task.due_at).getTime() < now ? `${reason} · vencida` : reason }
}

export function projectDashboard(projects: Project[], tasks: Task[], month: string) {
  const active = projects.filter((project) => project.status === 'active')
  const paused = projects.filter((project) => project.status === 'paused')
  const completed = projects.filter((project) => project.status === 'completed' && project.completed_at?.startsWith(month))
  const activeTasks = active.flatMap((project) => validProjectTasks(project.id, tasks))
  const done = activeTasks.filter((task) => task.status === 'completed').length
  return { active, paused, completed, progress: activeTasks.length ? done / activeTasks.length * 100 : null, completedTasks: done, totalTasks: activeTasks.length, next: nextProjectAction(projects, tasks) }
}

export function useProjectsWorkspace(userId: string | undefined, month: string) {
  const projects = useProjects(userId)
  const tasks = useTasks(userId)
  const data = projects.data && tasks.data ? projectDashboard(projects.data, tasks.data, month) : undefined
  return { ...projects, projects: projects.data ?? [], tasks, data, isLoading: projects.isLoading || tasks.isLoading, error: projects.error ?? tasks.error }
}

export function useProjectMutations(userId: string | undefined) {
  const client = useQueryClient()
  const invalidate = async () => { if (userId) { await client.invalidateQueries({ queryKey: projectKeys.all(userId) }); await client.invalidateQueries({ queryKey: taskKeys.all(userId) }) } }
  return {
    create: useMutation({ mutationFn: async (input: ProjectInput) => need<Project>(await supabase.from('projects').insert({ ...input, user_id: userId!, progress_mode: 'tasks' }).select().single()), onSuccess: invalidate }),
    update: useMutation({ mutationFn: async ({ id, input }: { id: string; input: ProjectInput }) => need(await supabase.from('projects').update(input).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate }),
    setStatus: useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => need(await supabase.from('projects').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: async (id: string) => need(await supabase.from('projects').delete().eq('id', id).eq('user_id', userId!).select('id').single()), onSuccess: invalidate }),
  }
}
