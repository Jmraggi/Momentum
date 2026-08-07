/* eslint-disable react-refresh/only-export-components */
import { Check, Dumbbell, FolderKanban, HeartPulse, ListTodo, Plus, Scale, WalletCards, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export interface UndoNotice {
  message: string
  undo: () => Promise<unknown> | unknown
}

interface UndoContextValue {
  notify: (notice: UndoNotice) => void
}

const UndoContext = createContext<UndoContextValue | null>(null)
export const QUICK_ACTION_EVENT = 'momentum:quick-action'

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<UndoNotice | null>(null)
  const [undoing, setUndoing] = useState(false)
  const timer = useRef<number>()

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    setNotice(null)
  }, [])

  const notify = useCallback((next: UndoNotice) => {
    if (timer.current) window.clearTimeout(timer.current)
    setNotice(next)
    timer.current = window.setTimeout(() => setNotice(null), 6_000)
  }, [])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const undo = async () => {
    if (!notice || undoing) return
    if (timer.current) window.clearTimeout(timer.current)
    setUndoing(true)
    try {
      await notice.undo()
      setNotice(null)
    } finally {
      setUndoing(false)
    }
  }

  return <UndoContext.Provider value={{ notify }}>{children}{notice && <aside aria-live="polite" className="undo-toast" role="status"><Check aria-hidden="true" size={18} /><span>{notice.message}</span><button disabled={undoing} onClick={() => void undo()} type="button">{undoing ? 'Deshaciendo…' : 'Deshacer'}</button><button aria-label="Cerrar notificación" onClick={dismiss} type="button"><X size={16} /></button></aside>}</UndoContext.Provider>
}

export function useUndoToast() {
  const context = useContext(UndoContext)
  if (!context) throw new Error('useUndoToast debe usarse dentro de UndoToastProvider.')
  return context
}

const actions = [
  { label: 'Registrar peso', path: '/salud', action: 'weight', icon: Scale },
  { label: 'Registrar entrenamiento', path: '/salud', action: 'workout', icon: Dumbbell },
  { label: 'Check-in de salud', path: '/salud', action: 'checkin', icon: HeartPulse },
  { label: 'Marcar o crear hábito', path: '/habitos', action: 'habit', icon: Check },
  { label: 'Nueva tarea', path: '/prioridades', action: 'task', icon: ListTodo },
  { label: 'Nuevo proyecto', path: '/proyectos', action: 'project', icon: FolderKanban },
  { label: 'Añadir ingreso o gasto', path: '/finanzas', action: 'transaction', icon: WalletCards },
] as const

export function QuickEntryLauncher() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const choose = (path: string, action: string) => {
    setOpen(false)
    requestId.current += 1
    window.dispatchEvent(new CustomEvent<string>(QUICK_ACTION_EVENT, { detail: action }))
    navigate(path, { state: { openAction: action, requestId: requestId.current } })
  }

  return <><button aria-expanded={open} aria-haspopup="dialog" aria-label="Nuevo registro" className="global-quick-button" onClick={() => setOpen(true)} type="button"><Plus size={20} /><span>Nuevo registro</span></button>{open && <div className="home-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }} role="presentation"><section aria-labelledby="global-quick-title" aria-modal="true" className="home-modal home-quick-actions" ref={dialog} role="dialog"><div className="section-heading"><div><p className="eyebrow">Acción rápida</p><h2 id="global-quick-title">¿Qué querés registrar?</h2></div><button aria-label="Cerrar" className="text-button" onClick={() => setOpen(false)} type="button"><X size={18} /></button></div>{actions.map(({ action, icon: Icon, label, path }) => <button key={action} onClick={() => choose(path, action)} type="button"><Icon size={19} />{label}</button>)}</section></div>}</>
}
