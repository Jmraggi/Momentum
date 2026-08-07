import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type HealthSettings = Database['public']['Tables']['health_settings']['Row']
export type Metric = Database['public']['Tables']['metrics']['Row']
export type MetricEntry = Database['public']['Tables']['metric_entries']['Row']
export type Workout = Database['public']['Tables']['workouts']['Row']
export type HealthDailySummary = Database['public']['Tables']['health_daily_summaries']['Row']

const required = <T,>(result: { data: T | null; error: { message: string } | null }): T => {
  if (result.error) throw new Error(result.error.message)
  if (result.data === null) throw new Error('Sin respuesta de Supabase.')
  return result.data
}

export const healthKeys = {
  root: (userId: string) => ['health', userId] as const,
  dashboard: (userId: string, days: number) => ['health', userId, 'dashboard', days] as const,
}

export const metricDefinitions = [
  { slug: 'body_weight', name: 'Peso corporal', unit: 'kg', min: 20, max: 500 },
  { slug: 'sleep_duration', name: 'Horas de sueño', unit: 'h', min: 0, max: 24 },
  { slug: 'sleep_quality', name: 'Calidad del sueño', unit: '/5', min: 1, max: 5 },
  { slug: 'energy_level', name: 'Energía', unit: '/5', min: 1, max: 5 },
  { slug: 'fatigue_level', name: 'Fatiga', unit: '/5', min: 1, max: 5 },
  { slug: 'mood_level', name: 'Ánimo', unit: '/5', min: 1, max: 5 },
  { slug: 'water_ml', name: 'Agua', unit: 'ml', min: 0, max: 20000 },
  { slug: 'steps', name: 'Pasos', unit: 'pasos', min: 0, max: 100000 },
] as const

const defaultSettings: Omit<HealthSettings, 'user_id' | 'created_at' | 'updated_at'> = {
  timezone: 'America/Argentina/Buenos_Aires', water_goal_ml: 2000, steps_goal: 8000, show_readiness: true,
}

const isoDaysAgo = (days: number) => { const value = new Date(); value.setDate(value.getDate() - days); return value.toISOString() }
export const healthToday = () => new Date().toLocaleDateString('en-CA')

export interface HealthDashboardData { settings: HealthSettings | null; metrics: Metric[]; entries: MetricEntry[]; workouts: Workout[]; dailySummaries: HealthDailySummary[] }

export function useHealthDashboard(userId: string | undefined, days: number) {
  return useQuery({
    queryKey: healthKeys.dashboard(userId ?? '', days), enabled: Boolean(userId), retry: false, staleTime: 60_000,
    queryFn: async (): Promise<HealthDashboardData> => {
      const [settings, metrics] = await Promise.all([
        supabase.from('health_settings').select('*').eq('user_id', userId!).maybeSingle(),
        supabase.from('metrics').select('*').eq('user_id', userId!).eq('pillar', 'health').in('slug', metricDefinitions.map(({ slug }) => slug)),
      ])
      if (settings.error) throw new Error(settings.error.message)
      const metricRows = required(metrics)
      const [entries, workouts, dailySummaries] = await Promise.all([
        metricRows.length ? supabase.from('metric_entries').select('*').eq('user_id', userId!).in('metric_id', metricRows.map(({ id }) => id)).gte('recorded_at', isoDaysAgo(Math.max(days, 365))).order('recorded_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
        supabase.from('workouts').select('*').eq('user_id', userId!).gte('started_at', isoDaysAgo(Math.max(days, 365))).order('started_at', { ascending: false }),
        supabase.from('health_daily_summaries').select('*').eq('user_id', userId!).gte('summary_date', new Date(Date.now() - Math.max(days, 7) * 86_400_000).toLocaleDateString('en-CA')).order('summary_date', { ascending: false }),
      ])
      return { settings: settings.data, metrics: metricRows, entries: required(entries), workouts: required(workouts), dailySummaries: required(dailySummaries) }
    },
  })
}

export function settingsFor(data: HealthDashboardData): HealthSettings | Omit<HealthSettings, 'user_id' | 'created_at' | 'updated_at'> { return data.settings ?? defaultSettings }

export function useDailyMetricMutation(userId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ slug, value, date = healthToday() }: { slug: 'water_ml' | 'steps'; value: number | null; date?: string }) => {
      const definition = metricDefinitions.find((item) => item.slug === slug)
      if (!definition || (value !== null && (!Number.isFinite(value) || value < definition.min || value > definition.max))) throw new Error('Valor inválido.')
      const metrics = required(await supabase.from('metrics').upsert({ user_id: userId!, slug, name: definition.name, pillar: 'health', data_type: 'numeric', unit: definition.unit, aggregation: 'latest' }, { onConflict: 'user_id,slug', ignoreDuplicates: true }).select('*'))
      const metric = metrics[0] ?? required(await supabase.from('metrics').select('*').eq('user_id', userId!).eq('slug', slug).single())
      const sourceResult = await supabase.from('data_sources').select('id').eq('user_id', userId!).eq('source_type', 'manual').maybeSingle()
      if (sourceResult.error) throw new Error(sourceResult.error.message)
      if (!sourceResult.data) throw new Error('No se encontró la fuente manual.')
      if (value === null) {
        const removed = await supabase.from('metric_entries').delete().eq('user_id', userId!).eq('metric_id', metric.id).eq('check_in_date', date).eq('data_source_id', sourceResult.data.id)
        if (removed.error) throw new Error(removed.error.message)
        return null
      }
      return required(await supabase.from('metric_entries').upsert({ user_id: userId!, metric_id: metric.id, data_source_id: sourceResult.data.id, numeric_value: value, recorded_at: new Date(`${date}T12:00:00`).toISOString(), check_in_date: date, metadata: { slug } }, { onConflict: 'user_id,metric_id,check_in_date' }).select().single())
    },
    onSuccess: async () => { if (userId) await client.invalidateQueries({ queryKey: healthKeys.root(userId) }) },
  })
}

export function useHealthSettingsMutation(userId: string | undefined) {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (input: Pick<HealthSettings, 'water_goal_ml' | 'steps_goal' | 'show_readiness' | 'timezone'>) => required(await supabase.from('health_settings').upsert({ user_id: userId!, ...input }, { onConflict: 'user_id' }).select().single()),
    onSuccess: async () => { if (userId) await client.invalidateQueries({ queryKey: healthKeys.root(userId) }) },
  })
}
