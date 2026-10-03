import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout, Logo } from './components/Layout'
import { Spinner, ToastProvider } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { Activity } from './pages/Activity'
import { ForgotPassword, Login, ResetPassword, Signup } from './pages/Auth'
import { DoctorView } from './pages/DoctorView'
import { Emergency } from './pages/Emergency'
import { Home } from './pages/Home'
import { Landing } from './pages/Landing'
import { Profile } from './pages/Profile'
import { Records } from './pages/Records'
import { ShareDetail } from './pages/ShareDetail'
import { ShareNew } from './pages/ShareNew'
import { Shares } from './pages/Shares'

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

// Logged-in people skip the login/signup pages. New accounts go straight to filling in their details;
// returning users go back to the page they were trying to open.
function GuestOnly({ children, to }: { children: ReactNode; to?: string }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
  return session ? <Navigate to={to ?? from ?? '/home'} replace /> : children
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo className="text-lg" />
        <h1 className="mt-6 text-2xl font-bold">This page does not exist</h1>
        <Link to="/" className="mt-4 inline-block font-semibold text-brass-deep underline underline-offset-2">Go to the home page</Link>
      </div>
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Logo className="text-lg" />
      <h1 className="mt-6 text-2xl font-bold">Connect the database</h1>
      <p className="mt-2 text-ink-2">Set <code className="rounded bg-ink/5 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-ink/5 px-1">VITE_SUPABASE_ANON_KEY</code>, then rebuild. See README.md for the steps.</p>
    </div>
  )
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* doctor's viewer: public, no session needed */}
          <Route path="/v/:token" element={<DoctorView />} />

          <Route path="/" element={<AuthProvider><Landing /></AuthProvider>} />
          <Route path="/login" element={<AuthProvider><GuestOnly><Login /></GuestOnly></AuthProvider>} />
          <Route path="/signup" element={<AuthProvider><GuestOnly to="/profile?welcome=1"><Signup /></GuestOnly></AuthProvider>} />
          <Route path="/forgot" element={<AuthProvider><ForgotPassword /></AuthProvider>} />
          <Route path="/reset" element={<AuthProvider><ResetPassword /></AuthProvider>} />

          <Route element={<AuthProvider><RequireAuth><AppLayout /></RequireAuth></AuthProvider>}>
            <Route path="/home" element={<Home />} />
            <Route path="/records" element={<Navigate to="/records/allergies" replace />} />
            <Route path="/records/:tab" element={<Records />} />
            <Route path="/share/new" element={<ShareNew />} />
            <Route path="/shares" element={<Shares />} />
            <Route path="/shares/:id" element={<ShareDetail />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/emergency" element={<Emergency />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
