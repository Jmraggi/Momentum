import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function PasswordRecoveryPage() {
  const navigate = useNavigate(); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage(''); if (password.length < 8) { setMessage('La contraseña debe tener al menos 8 caracteres.'); return }; if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return }; setSaving(true); const { error } = await supabase.auth.updateUser({ password }); setSaving(false); if (error) { setMessage('El enlace no es válido o expiró. Solicitá uno nuevo.'); return }; navigate('/inicio', { replace: true }) }
  return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><KeyRound size={25} /></div><p className="eyebrow">Seguridad</p><h1>Nueva contraseña</h1><p>Elegí una contraseña nueva para tu cuenta.</p><form onSubmit={submit}><label>Nueva contraseña<input autoComplete="new-password" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label>Repetir contraseña<input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></label>{message && <p className="auth-message" role="alert">{message}</p>}<button className="primary-button" disabled={saving} type="submit">{saving ? 'Guardando…' : 'Guardar contraseña'}</button></form></section></main>
}
