import { Activity, FolderHeart, House, KeyRound, LogOut, Siren, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cx } from './ui'

const nav = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/records', label: 'Records', icon: FolderHeart },
  { to: '/shares', label: 'Sharing', icon: KeyRound },
  { to: '/activity', label: 'Activity', icon: Activity },
]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-bold tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect x="6" y="9" width="20" height="21" rx="6" className="fill-brass" />
        <circle cx="16" cy="9" r="6" fill="none" strokeWidth="3" className="stroke-ink" />
        <path d="M16 15v7m-3.5-3.5h7" strokeWidth="2.6" strokeLinecap="round" className="stroke-white" />
      </svg>
      SwasthyaKey
    </span>
  )
}

export function AppLayout() {
  const navigate = useNavigate()
  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      {/* desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-6 md:flex">
        <NavLink to="/home" className="px-2"><Logo className="text-lg" /></NavLink>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 font-semibold', isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-ink/5')}>
              <Icon className="size-5" aria-hidden /> {label}
            </NavLink>
          ))}
          <NavLink to="/emergency" className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 font-semibold', isActive ? 'bg-stop text-white' : 'text-stop hover:bg-stop-soft')}>
            <Siren className="size-5" aria-hidden /> Emergency card
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <NavLink to="/profile" className={({ isActive }) => cx('flex h-11 items-center gap-3 rounded-xl px-3 font-semibold', isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-ink/5')}>
            <UserRound className="size-5" aria-hidden /> My details
          </NavLink>
          <button onClick={signOut} className="flex h-11 items-center gap-3 rounded-xl px-3 font-semibold text-ink-2 hover:bg-ink/5">
            <LogOut className="size-5" aria-hidden /> Log out
          </button>
        </div>
      </aside>

      {/* phone header */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur md:hidden">
        <NavLink to="/home"><Logo /></NavLink>
        <div className="flex items-center gap-1">
          <NavLink to="/emergency" aria-label="Emergency card" className="grid size-10 place-items-center rounded-full text-stop hover:bg-stop-soft"><Siren className="size-5" /></NavLink>
          <NavLink to="/profile" aria-label="My details" className="grid size-10 place-items-center rounded-full hover:bg-ink/5"><UserRound className="size-5" /></NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 md:px-8 md:pt-10 md:pb-16">
        <Outlet />
      </main>

      {/* phone tab bar */}
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold', isActive ? 'text-ink' : 'text-ink-3')}>
            {({ isActive }) => (
              <>
                <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-brass-soft text-brass-deep')}><Icon className="size-5" aria-hidden /></span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export function PageTitle({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-[34px]">{title}</h1>
        {body && <p className="mt-1.5 max-w-xl text-ink-2">{body}</p>}
      </div>
      {action}
    </div>
  )
}
