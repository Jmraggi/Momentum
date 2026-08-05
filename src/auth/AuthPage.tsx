import { LockKeyhole, LogIn, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function AuthPage() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(''); setIsSubmitting(true)
    const result = isRegistering ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
    setIsSubmitting(false)
    setMessage(result.error ? result.error.message : isRegistering ? 'Cuenta creada. Ya podés continuar.' : '')
  }
  return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><LockKeyhole size={25} /></div><p className="eyebrow">Momentum</p><h1>{isRegistering ? 'Creá tu cuenta' : 'Bienvenido de nuevo'}</h1><p>{isRegistering ? 'Empezá a organizar lo importante.' : 'Ingresá para continuar con tu espacio.'}</p><form onSubmit={submit}><label>Correo electrónico<input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label>Contraseña<input autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{message && <p aria-live="polite" className="auth-message">{message}</p>}<button className="primary-button" disabled={isSubmitting} type="submit">{isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}{isSubmitting ? 'Procesando…' : isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}</button></form><button className="auth-switch" onClick={() => { setIsRegistering(!isRegistering); setMessage('') }} type="button">{isRegistering ? 'Ya tengo una cuenta' : 'Quiero crear una cuenta'}</button></section></main>
}
