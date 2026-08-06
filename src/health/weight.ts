import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database, Json } from '../types/database'
import { healthKeys } from './dashboardData'

export type WeightEntry = Database['public']['Tables']['metric_entries']['Row']
export type WeightMetric = Database['public']['Tables']['metrics']['Row']
export interface WeightInput { value: number; recordedAt: string; note: string }
export interface WeightData { metric: WeightMetric | null; entries: WeightEntry[] }
const weightKey = (userId: string) => ['weight', userId] as const
function requireData<T>(result: { data: T | null; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); if (result.data === null) throw new Error('No se recibió una respuesta de Supabase.'); return result.data }

async function getWeightData(userId: string): Promise<WeightData> {
  const metricResult = await supabase.from('metrics').select('*').eq('user_id', userId).eq('slug', 'body_weight').maybeSingle()
  if (metricResult.error) throw new Error(metricResult.error.message)
  if (!metricResult.data) return { metric: null, entries: [] }
  const entries = requireData(await supabase.from('metric_entries').select('*').eq('user_id', userId).eq('metric_id', metricResult.data.id).order('recorded_at', { ascending: false }))
  return { metric: metricResult.data, entries }
}
export function useWeightData(userId: string | undefined) { return useQuery({ queryKey: weightKey(userId ?? ''), enabled: Boolean(userId), queryFn: () => getWeightData(userId!), retry: false }) }
export function useWeightMutations(userId: string | undefined) {
  const client = useQueryClient(); const invalidate = async () => { if (userId) { await client.invalidateQueries({ queryKey: weightKey(userId) }); await client.invalidateQueries({ queryKey: healthKeys.root(userId) }) } }
  const manualSource = async (): Promise<{ id: string }> => { const result = await supabase.from('data_sources').select('id').eq('user_id', userId!).eq('source_type', 'manual').maybeSingle(); if (result.error) throw new Error(result.error.message); if (!result.data) throw new Error('No se encontró la fuente manual del usuario.'); return result.data }
  const metadata = (note: string): Json => note ? { note } : {}
  const initialize = useMutation({ mutationFn: async () => { const created = await supabase.from('metrics').upsert({ user_id: userId!, slug: 'body_weight', name: 'Peso corporal', pillar: 'health', data_type: 'numeric', unit: 'kg', aggregation: 'latest' }, { onConflict: 'user_id,slug', ignoreDuplicates: true }).select().maybeSingle(); if (created.error) throw new Error(created.error.message); if (created.data) return created.data; return requireData(await supabase.from('metrics').select('*').eq('user_id', userId!).eq('slug', 'body_weight').maybeSingle()) }, onSuccess: invalidate, retry: false })
  const create = useMutation({ mutationFn: async ({ metricId, input }: { metricId: string; input: WeightInput }) => { const source = await manualSource(); return requireData(await supabase.from('metric_entries').insert({ user_id: userId!, metric_id: metricId, data_source_id: source.id, numeric_value: input.value, recorded_at: input.recordedAt, metadata: metadata(input.note) }).select().single()) }, onSuccess: invalidate, retry: false })
  const update = useMutation({ mutationFn: async ({ id, input }: { id: string; input: WeightInput }) => requireData(await supabase.from('metric_entries').update({ numeric_value: input.value, recorded_at: input.recordedAt, metadata: metadata(input.note) }).eq('id', id).eq('user_id', userId!).select().single()), onSuccess: invalidate, retry: false })
  const remove = useMutation({ mutationFn: async (id: string) => requireData(await supabase.from('metric_entries').delete().eq('id', id).eq('user_id', userId!).select('id').single()), onSuccess: invalidate, retry: false })
  return { initialize, create, update, remove }
}
export function noteFromEntry(entry: WeightEntry): string { return typeof entry.metadata === 'object' && entry.metadata !== null && !Array.isArray(entry.metadata) && typeof entry.metadata.note === 'string' ? entry.metadata.note : '' }
export function weightDifference(entries: WeightEntry[]): number | null { if (entries.length < 2 || entries[0].numeric_value === null || entries[1].numeric_value === null) return null; return Number(entries[0].numeric_value) - Number(entries[1].numeric_value) }
