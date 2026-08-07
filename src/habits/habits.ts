import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Habit = Database['public']['Tables']['habits']['Row']
export type HabitEntry = Database['public']['Tables']['habit_entries']['Row']
export type HabitPause = Database['public']['Tables']['habit_pause_periods']['Row']
export type HabitPreferences = Database['public']['Tables']['habit_preferences']['Row']
export type HabitRoutine = Database['public']['Tables']['habit_routines']['Row']
export type HabitRoutineItem = Database['public']['Tables']['habit_routine_items']['Row']
export type HabitInput = Pick<Habit, 'name' | 'description' | 'frequency_type' | 'target_count' | 'days_of_week' | 'start_date' | 'end_date' | 'habit_type' | 'tracking_type' | 'time_of_day' | 'target_value' | 'unit' | 'minimum_success_value'>
export type HabitEntryStatus = 'completed' | 'partial' | 'skipped' | 'avoided' | 'occurred'
type HabitDashboardData = { habits: Habit[]; entries: HabitEntry[]; pauses: HabitPause[]; preferences: HabitPreferences | null }

export const habitKeys = {
  root: (userId: string) => ['habits', userId] as const,
  dashboard: (userId: string, date: string) => ['habits', userId, 'dashboard', date] as const,
  routines: (userId: string) => ['habits', userId, 'routines'] as const,
}

const requireData = <T,>(result: { data: T | null; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Sin respuesta.')
  return result.data
}

const isoDate = (date = new Date()) => date.toLocaleDateString('en-CA')
const fromDate = (date: string) => new Date(`${date}T12:00:00`)
const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setDate(copy.getDate() + days); return copy }
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12)
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
const entryKey = (habitId: string, date: string) => `${habitId}:${date}`
const dateInPause = (date: string, pauses: HabitPause[]) => pauses.some((pause) => pause.starts_on <= date && (pause.ends_on === null || pause.ends_on >= date))

export function useHabits(userId: string | undefined, date = isoDate()) {
  return useQuery({
    queryKey: habitKeys.dashboard(userId ?? '', date), enabled: Boolean(userId), retry: false, staleTime: 60_000,
    queryFn: async () => {
      const habits = requireData(await supabase.from('habits').select('*').eq('user_id', userId!).order('created_at'))
      const ids = habits.map((habit) => habit.id)
      const from = isoDate(addDays(fromDate(date), -366))
      const [entries, pauses, preferences] = ids.length ? await Promise.all([
        supabase.from('habit_entries').select('*').eq('user_id', userId!).in('habit_id', ids).gte('entry_date', from).lte('entry_date', date).order('entry_date', { ascending: false }),
        supabase.from('habit_pause_periods').select('*').eq('user_id', userId!).in('habit_id', ids),
        supabase.from('habit_preferences').select('*').eq('user_id', userId!).maybeSingle(),
      ]) : [null, null, await supabase.from('habit_preferences').select('*').eq('user_id', userId!).maybeSingle()]
      if (entries?.error) throw new Error(entries.error.message)
      if (pauses?.error) throw new Error(pauses.error.message)
      if (preferences.error) throw new Error(preferences.error.message)
      return { habits, entries: entries?.data ?? [], pauses: pauses?.data ?? [], preferences: preferences.data ?? null }
    },
  })
}

export function useHabitRoutines(userId: string | undefined) {
  return useQuery({ queryKey: habitKeys.routines(userId ?? ''), enabled: Boolean(userId), retry: false, staleTime: 300_000, queryFn: async () => {
    const routines = requireData(await supabase.from('habit_routines').select('*').eq('user_id', userId!).order('created_at'))
    const items = routines.length ? requireData(await supabase.from('habit_routine_items').select('*').eq('user_id', userId!).in('routine_id', routines.map((routine) => routine.id)).order('position')) : []
    return { routines, items }
  } })
}

export function isHabitApplicable(habit: Habit, date: Date, pauses: HabitPause[] = []) {
  const key = isoDate(date)
  if (key < habit.start_date || (habit.end_date && key > habit.end_date) || dateInPause(key, pauses.filter((pause) => pause.habit_id === habit.id))) return false
  if (habit.frequency_type === 'weekly_count') return false
  if (!habit.is_active && key >= isoDate()) return false
  return habit.frequency_type !== 'specific_days' || habit.days_of_week?.includes(date.getDay()) === true
}

export function getEntryProgress(habit: Habit, entry: HabitEntry | undefined) {
  if (!entry || entry.status === 'skipped') return 0
  if (habit.habit_type === 'break') return entry.status === 'avoided' ? 1 : 0
  if (habit.tracking_type === 'binary') return entry.status === 'completed' ? 1 : 0
  return Math.min((entry.value ?? entry.completed_count) / habit.target_value, 1)
}

export function isHabitSuccessful(habit: Habit, entry: HabitEntry | undefined) {
  if (!entry || entry.status === 'skipped') return false
  if (habit.habit_type === 'break') return entry.status === 'avoided'
  if (habit.tracking_type === 'binary') return entry.status === 'completed'
  return (entry.value ?? entry.completed_count) >= habit.minimum_success_value
}

export function getDailySummary(habits: Habit[], entries: HabitEntry[], pauses: HabitPause[], date = new Date()) {
  const key = isoDate(date); const byEntry = new Map(entries.map((entry) => [entryKey(entry.habit_id, entry.entry_date), entry]))
  const applicable = habits.filter((habit) => isHabitApplicable(habit, date, pauses))
  const eligible = applicable.filter((habit) => byEntry.get(entryKey(habit.id, key))?.status !== 'skipped')
  const completed = eligible.filter((habit) => isHabitSuccessful(habit, byEntry.get(entryKey(habit.id, key)))).length
  const score = eligible.length ? eligible.reduce((sum, habit) => sum + getEntryProgress(habit, byEntry.get(entryKey(habit.id, key))), 0) / eligible.length * 100 : 0
  const weekStart = addDays(date, -((date.getDay() + 6) % 7)); const weekly = habits.filter((habit) => habit.frequency_type === 'weekly_count' && habit.is_active && !dateInPause(key, pauses.filter((pause) => pause.habit_id === habit.id)))
  const weeklyProgress = weekly.map((habit) => ({ habit, value: entries.filter((entry) => entry.habit_id === habit.id && entry.entry_date >= isoDate(weekStart) && entry.entry_date <= key && isHabitSuccessful(habit, entry)).length }))
  return { applicable: eligible, completed, score, weeklyProgress }
}

export function habitStreaks(habit: Habit, entries: HabitEntry[], pauses: HabitPause[] = [], reference = new Date()) {
  const byEntry = new Map(entries.map((entry) => [entryKey(entry.habit_id, entry.entry_date), entry])); let current = 0; let best = 0; let run = 0; let currentOpen = true
  for (let offset = 0; offset < 366; offset += 1) {
    const date = addDays(reference, -offset)
    if (!isHabitApplicable(habit, date, pauses)) continue
    const success = isHabitSuccessful(habit, byEntry.get(entryKey(habit.id, isoDate(date))))
    if (success) { run += 1; best = Math.max(best, run); if (currentOpen) current = run } else { currentOpen = false; run = 0 }
  }
  return { current, best }
}

export function generalStreak(habits: Habit[], entries: HabitEntry[], pauses: HabitPause[], threshold = 0.8, reference = new Date()) {
  let current = 0; let best = 0; let run = 0; let currentOpen = true
  for (let offset = 0; offset < 366; offset += 1) {
    const date = addDays(reference, -offset); const summary = getDailySummary(habits, entries, pauses, date)
    if (!summary.applicable.length) continue
    if (summary.score >= threshold * 100) { run += 1; best = Math.max(best, run); if (currentOpen) current = run } else { currentOpen = false; run = 0 }
  }
  return { current, best }
}

export interface HabitDayInsight { date: string; score: number | null; applicable: number; completed: number }

export function getHabitAnalytics(habits: Habit[], entries: HabitEntry[], pauses: HabitPause[], reference = new Date()) {
  const today = isoDate(reference); const monthStart = startOfMonth(reference); const monthEnd = endOfMonth(reference)
  const monthDays: HabitDayInsight[] = []
  for (let day = new Date(monthStart); day <= monthEnd; day = addDays(day, 1)) {
    const key = isoDate(day)
    if (key > today) { monthDays.push({ date: key, score: null, applicable: 0, completed: 0 }); continue }
    const summary = getDailySummary(habits, entries, pauses, day)
    monthDays.push({ date: key, score: summary.applicable.length ? summary.score : null, applicable: summary.applicable.length, completed: summary.completed })
  }
  const weeklyStart = addDays(reference, -((reference.getDay() + 6) % 7)); const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weeklyStart, index))
  const matrix = habits.filter((habit) => habit.frequency_type !== 'weekly_count').map((habit) => ({ habit, days: weekDates.map((date) => {
    const key = isoDate(date); const applicable = key <= today && isHabitApplicable(habit, date, pauses); const entry = entries.find((item) => item.habit_id === habit.id && item.entry_date === key)
    return { date: key, applicable, progress: applicable ? getEntryProgress(habit, entry) : null }
  }) }))
  const opportunities: number[] = []; let activeDays = 0
  for (let offset = 0; offset < 366; offset += 1) {
    const date = addDays(reference, -offset); const summary = getDailySummary(habits, entries, pauses, date)
    if (summary.score > 0 || entries.some((entry) => entry.entry_date === isoDate(date))) activeDays += 1
    if (summary.applicable.length) opportunities.push(summary.score)
  }
  const last28 = opportunities.slice(0, 28); const consistency = last28.length ? last28.reduce((sum, score) => sum + score, 0) / last28.length : 0
  const consistencyLevel = consistency < 40 ? 'Inicial' : consistency < 70 ? 'En desarrollo' : consistency < 85 ? 'Consistente' : 'Consolidado'
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(reference.getFullYear(), reference.getMonth() - (11 - index), 1, 12); const start = startOfMonth(month); const end = endOfMonth(month); let progress = 0; let count = 0
    for (let day = new Date(start); day <= end && isoDate(day) <= today; day = addDays(day, 1)) { const summary = getDailySummary(habits, entries, pauses, day); if (summary.applicable.length) { progress += summary.score; count += 1 } }
    return { label: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(month), score: count ? progress / count : null }
  })
  return { monthDays, matrix, activeDays, consistency, consistencyLevel, opportunityCount: last28.length, months }
}

export function getRiskHabits(habits: Habit[], entries: HabitEntry[], pauses: HabitPause[], now = new Date()) {
  const cutoffs: Record<string, number> = { morning: 12, afternoon: 18, evening: 22, before_sleep: 24, anytime: 24 }
  const today = isoDate(now); const byEntry = new Map(entries.map((entry) => [entryKey(entry.habit_id, entry.entry_date), entry])); const remaining = 6 - ((now.getDay() + 6) % 7)
  return habits.filter((habit) => {
    if (habit.frequency_type === 'weekly_count') {
      const done = entries.filter((entry) => entry.habit_id === habit.id && entry.entry_date >= isoDate(addDays(now, -((now.getDay() + 6) % 7))) && entry.entry_date <= today && isHabitSuccessful(habit, entry)).length
      return habit.is_active && habit.target_value - done > remaining
    }
    return isHabitApplicable(habit, now, pauses) && !isHabitSuccessful(habit, byEntry.get(entryKey(habit.id, today))) && now.getHours() >= cutoffs[habit.time_of_day]
  })
}

export function useHabitMutations(userId: string | undefined) {
  const client = useQueryClient(); const invalidate = async () => { if (userId) await client.invalidateQueries({ queryKey: habitKeys.root(userId) }) }
  return {
    create: useMutation({ retry: false, mutationFn: async (input: HabitInput) => requireData(await supabase.from('habits').insert({ ...input, user_id: userId!, pillar: 'habits', linked_entity_type: null, linked_entity_id: null }).select().single()), onSuccess: invalidate }),
    update: useMutation({ retry: false, mutationFn: async ({ id, input }: { id: string; input: HabitInput }) => requireData(await supabase.from('habits').update(input).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate }),
    entry: useMutation({ retry: false, mutationFn: async ({ habit, date, value, status }: { habit: Habit; date: string; value: number | null; status: HabitEntryStatus | null }) => requireData(await supabase.from('habit_entries').upsert({ user_id: userId!, habit_id: habit.id, entry_date: date, completed_count: value ?? 0, value, status }, { onConflict: 'habit_id,entry_date' }).select().single()), onMutate: async ({ habit, date, value, status }) => { if (!userId) return; await client.cancelQueries({ queryKey: habitKeys.root(userId) }); const snapshots = client.getQueriesData<HabitDashboardData>({ queryKey: habitKeys.root(userId) }); client.setQueriesData<HabitDashboardData>({ queryKey: habitKeys.root(userId) }, (current) => { if (!current) return current; const optimistic: HabitEntry = { id: `optimistic-${habit.id}-${date}`, user_id: userId, habit_id: habit.id, entry_date: date, completed_count: value ?? 0, value, status, skipped_reason: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; return { ...current, entries: [optimistic, ...current.entries.filter((entry) => !(entry.habit_id === habit.id && entry.entry_date === date))] } }); return { snapshots } }, onError: (_error, _variables, context) => context?.snapshots.forEach(([key, data]) => client.setQueryData(key, data)), onSettled: invalidate }),
    restoreEntry: useMutation({ retry: false, mutationFn: async ({ habitId, date, previous }: { habitId: string; date: string; previous?: HabitEntry }) => { const removed = await supabase.from('habit_entries').delete().eq('user_id', userId!).eq('habit_id', habitId).eq('entry_date', date); if (removed.error) throw new Error(removed.error.message); if (!previous) return null; const { id, created_at, updated_at, ...values } = previous; return requireData(await supabase.from('habit_entries').insert({ ...values, id, created_at, updated_at }).select().single()) }, onSuccess: invalidate }),
    pause: useMutation({ retry: false, mutationFn: async ({ habit, paused }: { habit: Habit; paused: boolean }) => {
      if (paused) { await requireData(await supabase.from('habit_pause_periods').insert({ user_id: userId!, habit_id: habit.id, starts_on: isoDate() }).select().single()); return requireData(await supabase.from('habits').update({ is_active: false }).eq('id', habit.id).eq('user_id', userId!).select().single()) }
      const closePause = await supabase.from('habit_pause_periods').update({ ends_on: isoDate(addDays(new Date(), -1)) }).eq('habit_id', habit.id).is('ends_on', null)
      if (closePause.error) throw new Error(closePause.error.message)
      return requireData(await supabase.from('habits').update({ is_active: true }).eq('id', habit.id).eq('user_id', userId!).select().single())
    }, onSuccess: invalidate }),
    remove: useMutation({ retry: false, mutationFn: async (id: string) => requireData(await supabase.from('habits').delete().eq('id', id).eq('user_id', userId!).select('id').single()), onSuccess: invalidate }),
  }
}

export function useHabitRoutineMutations(userId: string | undefined) {
  const client = useQueryClient(); const invalidate = async () => { if (userId) await client.invalidateQueries({ queryKey: habitKeys.root(userId) }) }
  return {
    create: useMutation({ retry: false, mutationFn: async ({ name, timeOfDay, triggerText, habitIds }: { name: string; timeOfDay: string | null; triggerText: string | null; habitIds: string[] }) => {
      const routine = requireData<HabitRoutine>(await supabase.from('habit_routines').insert({ user_id: userId!, name, description: null, time_of_day: timeOfDay, is_active: true }).select().single())
      if (habitIds.length) { const result = await supabase.from('habit_routine_items').insert(habitIds.map((habitId, position) => ({ user_id: userId!, routine_id: routine.id, habit_id: habitId, position, trigger_text: position === 0 ? triggerText : null }))); if (result.error) throw new Error(result.error.message) }
      return routine
    }, onSuccess: invalidate }),
    toggle: useMutation({ retry: false, mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => requireData(await supabase.from('habit_routines').update({ is_active: isActive }).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate }),
    remove: useMutation({ retry: false, mutationFn: async (id: string) => requireData(await supabase.from('habit_routines').delete().eq('id', id).eq('user_id', userId!).select('id').single()), onSuccess: invalidate }),
  }
}

export const habitToday = isoDate
