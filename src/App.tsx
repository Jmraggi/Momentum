import {
  Activity,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FolderKanban,
  HeartPulse,
  Home,
  LogOut,
  ListTodo,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AuthPage } from './auth/AuthPage'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { TasksBoard } from './tasks/TasksBoard'
import { EisenhowerWidget } from './tasks/EisenhowerWidget'
import { WeightPage } from './health/WeightPage'
import { useWeightData, weightDifference } from './health/weight'
import { getCheckinSummary, useDailyCheckinData } from './health/dailyCheckinData'
import { useWorkouts, workoutSummary } from './health/workoutData'
import { goalProgress, useGoals } from './health/goalData'
import { HabitsPage } from './habits/HabitsPage'
import { habitSummary, useHabits } from './habits/habits'
import { ProjectsPage } from './projects/ProjectsPage'
import { ProjectDetail } from './projects/ProjectDetail'
import { projectProgress, useProjects } from './projects/projects'

type IconComponent = typeof Home

interface NavigationItem {
  label: string
  path: string
  icon: IconComponent
}

interface Pillar {
  title: string
  description: string
  path: string
  icon: IconComponent
  tone: 'blue' | 'sky' | 'violet' | 'teal'
}

interface WeeklyPoint {
  label: string
  value: number
}

interface HabitPoint {
  label: string
  value: number
}

interface ActivityPoint {
  label: string
  value: number
}

const navigation: NavigationItem[] = [
  { label: 'Inicio', path: '/inicio', icon: Home },
  { label: 'Salud', path: '/salud', icon: HeartPulse },
  { label: 'Finanzas', path: '/finanzas', icon: CircleDollarSign },
  { label: 'Proyectos', path: '/proyectos', icon: FolderKanban },
  { label: 'Hábitos', path: '/habitos', icon: ClipboardList },
  { label: 'Prioridades', path: '/prioridades', icon: ListTodo },
]

const pillars: Pillar[] = [
  { title: 'Salud', description: 'Registrá cómo cuidás tu bienestar.', path: '/salud', icon: HeartPulse, tone: 'blue' },
  { title: 'Finanzas', description: 'Ordená tus movimientos y decisiones.', path: '/finanzas', icon: CircleDollarSign, tone: 'sky' },
  { title: 'Proyectos', description: 'Convertí tus ideas en próximos pasos.', path: '/proyectos', icon: FolderKanban, tone: 'violet' },
  { title: 'Hábitos', description: 'Construí una rutina que te acompañe.', path: '/habitos', icon: ClipboardList, tone: 'teal' },
]

const weeklyData: WeeklyPoint[] = []
const habitData: HabitPoint[] = []
const activityData: ActivityPoint[] = []
const dashboardNow = Date.now()

function App() {
  return <AuthProvider><Routes><Route path="/acceso" element={<GuestRoute><AuthPage /></GuestRoute>} /><Route path="*" element={<ProtectedRoute><MomentumApp /></ProtectedRoute>} /></Routes></AuthProvider>
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, session } = useAuth()
  if (isLoading) return <SessionLoading />
  return session ? <>{children}</> : <Navigate replace to="/acceso" />
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { isLoading, session } = useAuth()
  if (isLoading) return <SessionLoading />
  return session ? <Navigate replace to="/inicio" /> : <>{children}</>
}

function SessionLoading() {
  return <main className="session-loading"><span className="brand-mark">M</span><p>Restaurando tu sesión…</p></main>
}

function MomentumApp() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('momentum-sidebar') === 'collapsed')
  const { user } = useAuth()

  const closeMenu = () => setIsMenuOpen(false)
  const toggleSidebar = () => {
    setIsSidebarCollapsed((isCollapsed) => {
      const nextState = !isCollapsed
      localStorage.setItem('momentum-sidebar', nextState ? 'collapsed' : 'expanded')
      return nextState
    })
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${isMenuOpen ? 'sidebar--open' : ''}`}>
        <div className="brand-row">
          <NavLink aria-label="Ir al inicio" className="brand" to="/inicio" onClick={closeMenu}>
            <span className="brand-mark">M</span>
            <span className="brand-label">Momentum</span>
          </NavLink>
          <button aria-label={isSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'} className="icon-button sidebar-toggle" onClick={toggleSidebar} title={isSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'} type="button">
            {isSidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button aria-label="Cerrar menú" className="icon-button sidebar-close" onClick={closeMenu} type="button">
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Navegación principal" className="main-nav">
          {navigation.map(({ icon: Icon, label, path }) => (
            <NavLink aria-label={label} className="nav-link" key={path} title={label} to={path} onClick={closeMenu}>
              <Icon size={19} strokeWidth={2} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="user-email" title={user?.email}>{user?.email}</p>
          <NavLink aria-label="Configuración" className="nav-link" title="Configuración" to="/configuracion" onClick={closeMenu}>
            <Settings size={19} strokeWidth={2} />
            <span className="nav-label">Configuración</span>
          </NavLink>
        </div>
      </aside>
      {isMenuOpen && <button aria-label="Cerrar menú" className="menu-backdrop" onClick={closeMenu} type="button" />}
      <main className="main-content">
        <header className="mobile-header">
          <button aria-label="Abrir menú" className="icon-button" onClick={() => setIsMenuOpen(true)} type="button">
            <Menu size={22} />
          </button>
          <NavLink aria-label="Ir al inicio" className="brand" to="/inicio">
            <span className="brand-mark">M</span>
            <span className="brand-label">Momentum</span>
          </NavLink>
          <span className="header-spacer" />
        </header>
        <Routes>
          <Route path="/" element={<Navigate replace to="/inicio" />} />
          <Route path="/inicio" element={<Dashboard />} />
          <Route path="/salud" element={<WeightPage />} />
          <Route path="/habitos" element={<HabitsPage />} />
          <Route path="/proyectos" element={<ProjectsPage />} />
          <Route path="/proyectos/:id" element={<ProjectDetail />} />
          {pillars.filter((pillar) => pillar.path !== '/salud').map((pillar) => <Route key={pillar.path} path={pillar.path} element={<ModulePage pillar={pillar} />} />)}
          <Route path="/prioridades" element={<PrioritiesPage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  )
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</header>
}

function Dashboard() {
  return <div className="page dashboard">
    <PageHeader eyebrow="Resumen personal" title="Inicio" description="Tu panorama de hoy." action={<button className="primary-button" type="button"><Plus size={18} />Registrar</button>} />
    <section aria-labelledby="today-title" className="today-section">
      <div className="today-card"><div className="today-title"><span className="today-icon"><Activity size={19} /></span><div><p className="eyebrow">En foco</p><h2 id="today-title">Hoy</h2></div></div><p>Sin registros para hoy.</p><button className="text-button" type="button">Registrar <ChevronRight size={17} /></button></div>
    </section>
    <section aria-labelledby="pillars-title"><div className="section-heading"><div><p className="eyebrow">Tus pilares</p><h2 id="pillars-title">Resumen</h2></div></div><div className="summary-grid"><HealthSummaryCard />{pillars.filter((pillar) => pillar.title !== 'Salud').map(({ icon: Icon, title, path, tone }) => <NavLink aria-label={`Ver ${title}: sin datos`} className={`summary-card summary-card--${tone}`} key={path} to={path}><div className="summary-card-header"><span className="pillar-icon"><Icon size={19} /></span><TrendingUp aria-hidden="true" className="trend-icon" size={17} /></div><p>{title}</p><strong>{title === 'Proyectos' ? '0 activos' : title === 'Hábitos' ? '0 de 0' : 'Sin datos'}</strong><span className="summary-status"><i />Sin actividad</span><span aria-hidden="true" className="mini-progress"><i /></span></NavLink>)}</div></section>
    <EisenhowerWidget />
    <section aria-labelledby="charts-title" className="charts-section"><div className="section-heading"><div><p className="eyebrow">Vista general</p><h2 id="charts-title">Actividad</h2></div><span className="section-status">Sin datos este período</span></div><div className="charts-grid"><ChartCard className="chart-card--wide" title="Evolución semanal" status="Sin registros"><WeeklyChart /></ChartCard><ChartCard title="Cumplimiento de hábitos" status="0 de 0"><HabitsChart /></ChartCard><ChartCard title="Actividad por pilar" status="Sin datos"><ActivityChart /></ChartCard></div></section>
    <section className="dashboard-columns"><ProjectsSummary /><HabitsSummary /><HealthGoalsSummary /></section>
  </div>
}

function ProjectsSummary() {
  const { user } = useAuth(); const query = useProjects(user?.id)
  if (query.isLoading) return <CompactPanel icon={<FolderKanban size={19}/>} title="Proyectos" value="Cargando…" detail="" />
  if (query.error || !query.data) return <CompactPanel icon={<FolderKanban size={19}/>} title="Proyectos" value="No disponibles" detail="No se pudieron cargar los proyectos." />
  const active = query.data.projects.filter((project) => project.status === 'active'); const projectTasks = query.data.tasks; const pending = projectTasks.filter((task) => task.status !== 'completed'); const overdue = pending.filter((task) => task.due_at && new Date(task.due_at).getTime() < dashboardNow)
  return <section className="compact-panel"><div className="compact-panel-heading"><span className="empty-icon"><FolderKanban size={19}/></span><div><h2>Proyectos</h2><strong>{active.length} activos · {pending.length} pendientes</strong></div></div>{active.length ? <ul className="dashboard-goals">{active.slice(0, 3).map((project) => { const progress = projectProgress(project, projectTasks); return <li key={project.id}><NavLink to={`/proyectos/${project.id}`}><span>{project.name}</span><strong>{progress.completed}/{progress.total} tareas · {progress.percent.toFixed(0)}%</strong></NavLink></li> })}</ul> : <p>Todavía no hay proyectos activos.</p>}<p>{overdue.length ? `${overdue.length} tareas vencidas` : 'Sin tareas vencidas'}</p></section>
}

function HabitsSummary() { const { user } = useAuth(); const habits = useHabits(user?.id); if (habits.isLoading) return <CompactPanel icon={<ClipboardList size={19}/>} title="Hábitos" value="Cargando…" detail="" />; if (habits.error || !habits.data) return <CompactPanel icon={<ClipboardList size={19}/>} title="Hábitos" value="No disponibles" detail="No se pudieron cargar." />; const summary = habitSummary(habits.data.habits, habits.data.entries); return <NavLink className="compact-panel" to="/habitos"><div className="compact-panel-heading"><span className="empty-icon"><ClipboardList size={19}/></span><div><h2>Hábitos</h2><strong>{summary.completed}/{summary.active.length} completados</strong></div></div><p>{summary.active.length - summary.completed} pendientes hoy · {summary.weeklyPercent.toFixed(0)}% semanal</p></NavLink> }

function HealthGoalsSummary() {
  const { user } = useAuth(); const goals = useGoals(user?.id); const weight = useWeightData(user?.id); const workouts = useWorkouts(user?.id)
  if (goals.isLoading) return <CompactPanel icon={<Target size={19} />} title="Objetivos de salud" value="Cargando…" detail="" />
  if (goals.error) return <CompactPanel icon={<Target size={19} />} title="Objetivos de salud" value="No disponibles" detail="No se pudieron cargar los objetivos." />
  const active = (goals.data ?? []).filter((goal) => goal.status === 'active').sort((a, b) => { const first = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY; const second = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY; return first - second || new Date(a.created_at).getTime() - new Date(b.created_at).getTime() }).slice(0, 3); const training = workoutSummary(workouts.data ?? []); const current = (goal: typeof active[number]) => goal.target_type === 'weekly_frequency' ? training.count : goal.target_type === 'weekly_duration' ? training.minutes : weight.data?.entries[0]?.numeric_value ?? null
  return <section className="compact-panel"><div className="compact-panel-heading"><span className="empty-icon"><Target size={19} /></span><div><h2>Objetivos de salud</h2><strong>{active.length} activos</strong></div></div>{active.length ? <ul className="dashboard-goals">{active.map((goal) => { const value = current(goal); const progress = goalProgress(goal, value); return <li key={goal.id}><NavLink to="/salud"><span>{goal.title}</span><strong>{progress === null ? 'Sin datos' : `${progress.toFixed(0)}%`}{value !== null && goal.target_value !== null ? ` · ${value}/${goal.target_value}` : ''}{goal.due_date ? ` · ${new Intl.DateTimeFormat('es-AR',{dateStyle:'short'}).format(new Date(`${goal.due_date}T00:00:00`))}` : ''}</strong></NavLink></li> })}</ul> : <p>Todavía no hay objetivos activos.</p>}</section>
}

function HealthSummaryCard() {
  const { user } = useAuth(); const weight = useWeightData(user?.id); const checkin = useDailyCheckinData(user?.id); const workouts = useWorkouts(user?.id); const last = weight.data?.entries[0]; const difference = weight.data ? weightDifference(weight.data.entries) : null; const summary = checkin.data ? getCheckinSummary(checkin.data) : null; const training = workouts.data ? workoutSummary(workouts.data) : null
  const loading = weight.isLoading || checkin.isLoading; const failed = weight.error && checkin.error; const lines = [last ? `Peso: ${last.numeric_value} kg${difference === null ? '' : ` (${difference > 0 ? '+' : ''}${difference.toFixed(1)} kg)`}` : null, summary?.weeklySleep !== null && summary?.weeklySleep !== undefined ? `Sueño 7 días: ${summary.weeklySleep.toFixed(1)} h` : null, summary?.energy !== null && summary?.energy !== undefined ? `Energía: ${summary.energy}/5` : null, summary?.latestDate ? `Check-in: ${summary.latestDate}` : null].filter(Boolean)
  if (training && training.count) lines.push(`Entrenamientos: ${training.count} · ${training.minutes} min`)
  const value = loading ? 'Cargando…' : failed ? 'No se pudo cargar' : lines.length ? 'Datos actualizados' : 'Sin datos'
  return <NavLink aria-label={`Ver Salud: ${value}`} className="summary-card summary-card--blue" to="/salud"><div className="summary-card-header"><span className="pillar-icon"><HeartPulse size={19} /></span><TrendingUp aria-hidden="true" className="trend-icon" size={17} /></div><p>Salud</p><strong>{value}</strong><span className="summary-status"><i />{lines.length ? lines.join(' · ') : value}</span><span aria-hidden="true" className="mini-progress"><i /></span></NavLink>
}

function ChartCard({ children, className = '', status, title }: { children: ReactNode; className?: string; status: string; title: string }) {
  return <section className={`chart-card ${className}`}><div className="chart-card-header"><h3>{title}</h3><span>{status}</span></div>{children}</section>
}

function EmptyChart({ label }: { label: string }) {
  return <div aria-label={`${label}: sin datos disponibles`} className="chart-empty" role="img"><BarChart3 size={23} /><span>Sin datos</span></div>
}

function WeeklyChart() {
  if (weeklyData.length === 0) return <EmptyChart label="Evolución semanal" />
  return <div className="chart-area"><ResponsiveContainer height="100%" width="100%"><LineChart data={weeklyData}><CartesianGrid stroke="#26364d" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} /><YAxis axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} width={28} /><Tooltip contentStyle={{ background: '#16243a', border: '1px solid #36506f', borderRadius: 8, color: '#f8fafc' }} itemStyle={{ color: '#f8fafc' }} labelStyle={{ color: '#94a3b8' }} /><Line dataKey="value" dot={false} stroke="#3b82f6" strokeWidth={3} type="monotone" /></LineChart></ResponsiveContainer></div>
}

function HabitsChart() {
  if (habitData.length === 0) return <EmptyChart label="Cumplimiento de hábitos" />
  return <div className="chart-area"><ResponsiveContainer height="100%" width="100%"><BarChart data={habitData}><CartesianGrid stroke="#26364d" strokeDasharray="3 3" vertical={false} /><XAxis axisLine={false} dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} /><YAxis axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} width={28} /><Tooltip contentStyle={{ background: '#16243a', border: '1px solid #36506f', borderRadius: 8, color: '#f8fafc' }} itemStyle={{ color: '#f8fafc' }} labelStyle={{ color: '#94a3b8' }} /><Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
}

function ActivityChart() {
  if (activityData.length === 0) return <EmptyChart label="Actividad por pilar" />
  const colors = ['#3b82f6', '#60a5fa', '#818cf8', '#38bdf8']
  return <div className="chart-area"><ResponsiveContainer height="100%" width="100%"><PieChart><Pie cx="50%" cy="50%" data={activityData} dataKey="value" innerRadius={45} outerRadius={72} paddingAngle={3}>{activityData.map((item, index) => <Cell fill={colors[index % colors.length]} key={item.label} />)}</Pie><Tooltip contentStyle={{ background: '#16243a', border: '1px solid #36506f', borderRadius: 8, color: '#f8fafc' }} itemStyle={{ color: '#f8fafc' }} labelStyle={{ color: '#94a3b8' }} /></PieChart></ResponsiveContainer></div>
}

function CompactPanel({ icon, title, value, detail, action }: { icon: ReactNode; title: string; value: string; detail: string; action?: string }) {
  return <section className="compact-panel"><div className="compact-panel-heading"><span className="empty-icon">{icon}</span><div><h2>{title}</h2><strong>{value}</strong></div></div><p>{detail}</p>{action && <button className="text-button" type="button">{action} <ChevronRight size={17} /></button>}</section>
}

function ModulePage({ pillar }: { pillar: Pillar }) {
  const Icon = pillar.icon
  return <div className="page module-page"><PageHeader eyebrow="Pilar personal" title={pillar.title} description={pillar.description} action={<button className="primary-button" type="button"><Plus size={18} />Registrar</button>} /><section className="module-hero"><span className={`module-icon module-icon--${pillar.tone}`}><Icon size={28} /></span><h2>Este espacio está listo para vos</h2><p>Próximamente vas a poder registrar y consultar todo lo relacionado con {pillar.title.toLowerCase()}.</p><button className="secondary-button" type="button">Registrar</button></section></div>
}

function SettingsPage() {
  const { signOut, user } = useAuth()
  return <div className="page module-page"><PageHeader eyebrow="Preferencias" title="Configuración" description="Personalizá Momentum cuando necesites." /><section className="module-hero"><span className="module-icon module-icon--blue"><Settings size={28} /></span><h2>Tu espacio, a tu medida</h2><p>{user?.email}</p><button className="secondary-button" onClick={() => void signOut()} type="button"><LogOut size={17} />Cerrar sesión</button></section></div>
}

function PrioritiesPage() {
  return <div className="page priorities-page"><PageHeader eyebrow="Matriz de Eisenhower" title="Prioridades" description="Ordená tus tareas según urgencia e importancia." /><TasksBoard /></div>
}

function NotFoundPage() {
  return <div className="page not-found"><p className="eyebrow">Error 404</p><h1>Esta página no existe</h1><p className="page-description">Tal vez el enlace cambió o la página todavía no está disponible.</p><NavLink className="primary-button" to="/inicio"><Home size={18} />Volver al inicio</NavLink></div>
}

export default App
