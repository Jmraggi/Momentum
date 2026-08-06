import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { isTaskOverdue, type Task } from '../tasks/tasks'
import type { Project } from '../projects/projects'

export type DailyFocus = Database['public']['Tables']['daily_focuses']['Row']
export const homeToday = () => new Date().toLocaleDateString('en-CA')
export const homeKeys = { focus: (userId: string, date: string) => ['home', userId, 'focus', date] as const }

const need = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Sin respuesta.')
  return result.data
}

export function useDailyFocus(userId: string | undefined, date = homeToday()) {
  return useQuery({ queryKey: homeKeys.focus(userId ?? '', date), enabled: Boolean(userId), retry: false, queryFn: async () => {
    const result = await supabase.from('daily_focuses').select('*').eq('user_id', userId!).eq('focus_date', date).maybeSingle()
    if (result.error) throw new Error(result.error.message)
    return result.data
  } })
}

export function useDailyFocusMutation(userId: string | undefined, date = homeToday()) {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (input: { taskId: string; source: 'manual' | 'suggestion' }) => need<DailyFocus>(await supabase.from('daily_focuses').upsert({ user_id: userId!, focus_date: date, task_id: input.taskId, selection_source: input.source, selected_at: new Date().toISOString() }, { onConflict: 'user_id,focus_date' }).select().single()),
    onSuccess: (focus) => { if (userId) client.setQueryData(homeKeys.focus(userId, date), focus) },
  })
}

export function focusCandidates(tasks: Task[], projects: Project[]) {
  const activeProjects = new Set(projects.filter((project) => project.status === 'active').map((project) => project.id))
  return tasks.filter((task) => (task.status === 'pending' || task.status === 'in_progress') && task.is_urgent && task.is_important && (task.linked_entity_type !== 'project' || (task.linked_entity_id !== null && activeProjects.has(task.linked_entity_id)))).sort((a, b) => {
    const overdue = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a))
    if (overdue) return overdue
    const due = (a.due_at ?? '').localeCompare(b.due_at ?? '')
    if (due) return due
    const scheduled = (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? '')
    return scheduled || a.manual_order - b.manual_order || a.created_at.localeCompare(b.created_at)
  })
}

export function focusReason(task: Task) {
  if (isTaskOverdue(task)) return 'Está vencida'
  if (task.due_at) return `Vence ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(task.due_at))}`
  if (task.scheduled_at) return `Programada para ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(new Date(task.scheduled_at))}`
  return 'Hacer ahora · orden de la matriz'
}
