import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInput = Pick<Task, 'title' | 'description' | 'pillar' | 'is_urgent' | 'is_important' | 'due_at' | 'scheduled_at' | 'estimated_duration_minutes' | 'start_at' | 'energy_required' | 'focus_mode'>
export type TaskCreateInput = TaskInput & { linkedEntityType?: 'manual' | 'project'; linkedEntityId?: string | null; status?: 'pending' | 'in_progress' | 'blocked' }
export type TaskPillarFilter = 'all' | 'health' | 'finance' | 'projects' | 'habits' | 'manual'
export type TaskStateFilter = 'active' | 'completed' | 'overdue'
export type ProjectTaskContext = { id: string; status: string }
export type QuadrantTone = 'now' | 'plan' | 'delegate' | 'defer'

export const taskQuadrants = [
  { title: 'Hacer ahora', description: 'Urgente e importante', tone: 'now', isUrgent: true, isImportant: true },
  { title: 'Planificar', description: 'Importante, sin urgencia', tone: 'plan', isUrgent: false, isImportant: true },
  { title: 'Delegar', description: 'Urgente, sin importancia', tone: 'delegate', isUrgent: true, isImportant: false },
  { title: 'Posponer o eliminar', description: 'Sin urgencia ni importancia', tone: 'defer', isUrgent: false, isImportant: false },
] as const
export type TaskQuadrant = typeof taskQuadrants[number]
export const taskKeys = { all: (userId: string) => ['tasks', userId] as const }

const requireData = <T,>(result: { data: T | null; error: { message: string } | null }): T => { if (result.error) throw new Error(result.error.message); if (result.data === null) throw new Error('No se recibió una respuesta de Supabase.'); return result.data }
export const isTaskOverdue = (task: Task, now = Date.now()) => task.status !== 'completed' && task.status !== 'cancelled' && task.due_at !== null && new Date(task.due_at).getTime() < now
export const isTaskInQuadrant = (task: Task, quadrant: TaskQuadrant) => task.is_urgent === quadrant.isUrgent && task.is_important === quadrant.isImportant
export const findTaskQuadrant = (task: Task) => taskQuadrants.find((quadrant) => isTaskInQuadrant(task, quadrant)) ?? taskQuadrants[3]

export function isTaskEligibleForPriorities(task: Task, projects: ProjectTaskContext[], includePausedProjects: boolean) {
  if (task.status === 'cancelled') return false
  if (task.linked_entity_type !== 'project') return true
  const project = projects.find((item) => item.id === task.linked_entity_id)
  return project?.status === 'active' || (includePausedProjects && project?.status === 'paused')
}

export function filterPriorityTasks(tasks: Task[], projects: ProjectTaskContext[], filters: { pillar: TaskPillarFilter; state: TaskStateFilter; includePausedProjects: boolean }, now = Date.now()) {
  return tasks.filter((task) => {
    if (!isTaskEligibleForPriorities(task, projects, filters.includePausedProjects)) return false
    if (filters.pillar === 'manual' ? !(task.linked_entity_type === 'manual' || !task.pillar) : filters.pillar !== 'all' && task.pillar !== filters.pillar) return false
    if (filters.state === 'completed') return task.status === 'completed'
    if (filters.state === 'overdue') return isTaskOverdue(task, now)
    return task.status === 'pending' || task.status === 'in_progress' || task.status === 'blocked'
  }).sort((first, second) => {
    const firstOverdue = isTaskOverdue(first, now); const secondOverdue = isTaskOverdue(second, now)
    if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1
    const firstDue = first.due_at ? new Date(first.due_at).getTime() : Number.POSITIVE_INFINITY; const secondDue = second.due_at ? new Date(second.due_at).getTime() : Number.POSITIVE_INFINITY
    if (firstDue !== secondDue) return firstDue - secondDue
    const firstScheduled = first.scheduled_at ? new Date(first.scheduled_at).getTime() : Number.POSITIVE_INFINITY; const secondScheduled = second.scheduled_at ? new Date(second.scheduled_at).getTime() : Number.POSITIVE_INFINITY
    return firstScheduled - secondScheduled || first.manual_order - second.manual_order || new Date(first.created_at).getTime() - new Date(second.created_at).getTime()
  })
}

export function useTasks(userId: string | undefined) {
  return useQuery({ queryKey: taskKeys.all(userId ?? ''), enabled: Boolean(userId), queryFn: async () => requireData(await supabase.from('tasks').select('*').eq('user_id', userId!).order('is_important', { ascending: false }).order('is_urgent', { ascending: false }).order('manual_order').order('created_at', { ascending: false })) })
}

export function useTaskMutations(userId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = async () => { if (userId) { await queryClient.invalidateQueries({ queryKey: taskKeys.all(userId) }); await queryClient.invalidateQueries({ queryKey: ['projects', userId] }) } }
  const createTask = useMutation({ mutationFn: async (input: TaskCreateInput) => { const { linkedEntityType, linkedEntityId, status, ...values } = input; return requireData<Task>(await supabase.from('tasks').insert({ ...values, user_id: userId!, linked_entity_type: linkedEntityType ?? 'manual', linked_entity_id: linkedEntityId ?? null, status: status ?? 'pending' }).select().single()) }, onSuccess: invalidate })
  const updateTask = useMutation({ mutationFn: async ({ id, input }: { id: string; input: TaskInput }) => requireData(await supabase.from('tasks').update(input).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate })
  const completeTask = useMutation({ mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => requireData(await supabase.from('tasks').update({ status: completed ? 'completed' : 'pending', completed_at: completed ? new Date().toISOString() : null }).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate })
  const setTaskStatus = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => requireData(await supabase.from('tasks').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate })
  const setTaskQuadrant = useMutation({
    mutationKey: ['tasks', 'quadrant', userId],
    mutationFn: async ({ id, isUrgent, isImportant }: { id: string; isUrgent: boolean; isImportant: boolean }) => requireData<Task>(await supabase.from('tasks').update({ is_urgent: isUrgent, is_important: isImportant }).eq('id', id).eq('user_id', userId!).select().single()),
    onMutate: async ({ id, isUrgent, isImportant }) => { if (!userId) return undefined; await queryClient.cancelQueries({ queryKey: taskKeys.all(userId) }); const previous = queryClient.getQueryData<Task[]>(taskKeys.all(userId)); queryClient.setQueryData<Task[]>(taskKeys.all(userId), (current) => current?.map((task) => task.id === id ? { ...task, is_urgent: isUrgent, is_important: isImportant } : task)); return { previous } },
    onError: (_error, _variables, context) => { if (userId && context?.previous) queryClient.setQueryData(taskKeys.all(userId), context.previous) },
    onSuccess: (task) => { if (userId) queryClient.setQueryData<Task[]>(taskKeys.all(userId), (current) => current?.map((item) => item.id === task.id ? task : item)) },
    onSettled: invalidate,
  })
  const moveTask = useMutation({ mutationFn: async ({ task, delta }: { task: Task; delta: number }) => requireData(await supabase.from('tasks').update({ manual_order: task.manual_order + delta }).eq('id', task.id).eq('user_id', userId!).select().single()), onSuccess: invalidate })
  const deleteTask = useMutation({ mutationFn: async (id: string) => requireData(await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId!).select('id').single()), onSuccess: invalidate })
  return { createTask, updateTask, completeTask, setTaskStatus, setTaskQuadrant, moveTask, deleteTask }
}

export function getActiveTasksForQuadrant(tasks: Task[], match: (task: Task) => boolean) { return tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled' && match(task)).sort((a, b) => Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) || (a.due_at ?? '').localeCompare(b.due_at ?? '') || a.manual_order - b.manual_order) }
