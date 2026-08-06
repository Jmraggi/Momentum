import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
interface AuthContextValue { session: Session | null; user: User | null; profile: Profile | null; isLoading: boolean; signOut: () => Promise<void>; updateDisplayName: (displayName: string) => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadProfile = async (nextSession: Session | null) => {
      if (!nextSession) { if (active) setProfile(null); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', nextSession.user.id).maybeSingle()
      if (active) setProfile(data)
    }
    const restore = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      if (active) setIsLoading(false)
    }
    void restore()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession)
      setIsLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const signOut = async () => { await supabase.auth.signOut() }
  const updateDisplayName = async (displayName: string) => {
    if (!session) return
    const { data, error } = await supabase.from('profiles').update({ display_name: displayName.trim() || null }).eq('id', session.user.id).select().single()
    if (error) throw new Error(error.message)
    setProfile(data)
  }
  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, isLoading, signOut, updateDisplayName }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider'); return context }
