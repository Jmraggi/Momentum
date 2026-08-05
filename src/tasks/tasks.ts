import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInput = Pick<Task, 'title' | 'description' | 'pillar' | 'is_urgent' | 'is_important' | 'due_at' | 'scheduled_at' | 'estimated_duration_minutes'>
export const taskQuadrants = [
  { title: 'Hacer ahora', description: 'Urgente e importante', tone: 'now', match: (task: Task) => task.is_urgent && task.is_important },
  { title: 'Planificar', description: 'Importante, sin urgencia', tone: 'plan', match: (task: Task) => !task.is_urgent && task.is_important },
  { title: 'Delegar', description: 'Urgente, sin importancia', tone: 'delegate', match: (task: Task) => task.is_urgent && !task.is_important },
  { title: 'Posponer o eliminar', description: 'Sin urgencia ni importancia', tone: 'defer', match: (task: Task) => !task.is_urgent && !task.is_important },
] as const
const taskKey = (userId: string) => ['tasks', userId] as const

const requireData = <T,>(result: { data: T | null; error: { message: string } | null }): T => { if (result.error) throw new Error(result.error.message); if (result.data === null) throw new Error('No se recibió una respuesta de Supabase.'); return result.data }

export function useTasks(userId: string | undefined) {
  return useQuery({ queryKey: taskKey(userId ?? ''), enabled: Boolean(userId), queryFn: async () => requireData(await supabase.from('tasks').select('*').order('is_important', { ascending: false }).order('is_urgent', { ascending: false }).order('created_at', { ascending: false })) })
}

export function useTaskMutations(userId: string | undefined) {
  const queryClient = useQueryClient()
  const invalidate = async () => { if (userId) await queryClient.invalidateQueries({ queryKey: taskKey(userId) }) }
  const createTask = useMutation({ mutationFn: async (input: TaskInput) => requireData(await supabase.from('tasks').insert({ ...input, user_id: userId!, linked_entity_type: 'manual', linked_entity_id: null }).select().single()), onSuccess: invalidate })
  const updateTask = useMutation({ mutationFn: async ({ id, input }: { id: string; input: TaskInput }) => requireData(await supabase.from('tasks').update(input).eq('id', id).select().single()), onSuccess: invalidate })
  const completeTask = useMutation({ mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => requireData(await supabase.from('tasks').update({ status: completed ? 'completed' : 'pending', completed_at: completed ? new Date().toISOString() : null }).eq('id', id).select().single()), onSuccess: invalidate })
  const deleteTask = useMutation({ mutationFn: async (id: string) => requireData(await supabase.from('tasks').delete().eq('id', id).select('id').single()), onSuccess: invalidate })
  return { createTask, updateTask, completeTask, deleteTask }
}

export function getActiveTasksForQuadrant(tasks: Task[], match: (task: Task) => boolean) {
  const now = Date.now()
  return tasks.filter((task) => task.status !== 'completed' && match(task)).sort((first, second) => {
    const firstOverdue = first.due_at !== null && new Date(first.due_at).getTime() < now
    const secondOverdue = second.due_at !== null && new Date(second.due_at).getTime() < now
    if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1
    const firstDue = first.due_at ? new Date(first.due_at).getTime() : Number.POSITIVE_INFINITY
    const secondDue = second.due_at ? new Date(second.due_at).getTime() : Number.POSITIVE_INFINITY
    if (firstDue !== secondDue) return firstDue - secondDue
    return new Date(first.created_at).getTime() - new Date(second.created_at).getTime()
  })
}
