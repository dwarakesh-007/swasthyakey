import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { Button, ErrorNote, Field } from '../components/ui'
import { friendlyError, supabase } from '../lib/supabase'

function AuthShell({ title, body, children, foot }: { title: string; body: string; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8">
      <Link to="/" className="mb-10"><Logo className="text-lg" /></Link>
      <div className="w-full max-w-sm">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-ink-2">{body}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-ink-2">{foot}</p>
      </div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    // GuestOnly sends the person on to where they were headed
  }

  return (
    <AuthShell title="Log in" body="Open your health records." foot={<>New here? <Link to="/signup" className="font-semibold text-brass-deep underline underline-offset-2">Create an account</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" size="lg" loading={busy}>Log in</Button>
        <Link to="/forgot" className="text-center text-sm font-semibold text-ink-2 underline underline-offset-2">Forgot password?</Link>
      </form>
    </AuthShell>
  )
}

export function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password needs at least 8 characters.')
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/home` },
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    if (!data.session) setSent(true) // email confirmation is switched on in Supabase; otherwise GuestOnly moves on

  }

  if (sent)
    return (
      <AuthShell title="Check your email" body={`We sent a link to ${email}. Open it to finish creating your account.`} foot={<Link to="/login" className="font-semibold text-brass-deep underline underline-offset-2">Back to log in</Link>}>
        <p className="text-sm text-ink-3">Can't find it? Look in your spam folder.</p>
      </AuthShell>
    )

  return (
    <AuthShell title="Create your account" body="Free. Your records stay private until you share them." foot={<>Already have an account? <Link to="/login" className="font-semibold text-brass-deep underline underline-offset-2">Log in</Link></>}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Full name" autoComplete="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} hint="As it appears on your hospital records" />
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters" />
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" size="lg" loading={busy}>Create account</Button>
      </form>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset` })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else setSent(true)
  }
  return (
    <AuthShell title="Reset password" body={sent ? `If ${email} has an account, a reset link is on its way.` : 'We will email you a link to set a new password.'} foot={<Link to="/login" className="font-semibold text-brass-deep underline underline-offset-2">Back to log in</Link>}>
      {!sent && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" size="lg" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && setReady(true))
    const { data } = supabase.auth.onAuthStateChange((event) => (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && setReady(true))
    return () => data.subscription.unsubscribe()
  }, [])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Password needs at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else navigate('/home', { replace: true })
  }
  return (
    <AuthShell title="Set a new password" body={ready ? 'Choose a password you have not used here before.' : 'Open this page from the link in your email.'} foot={<Link to="/login" className="font-semibold text-brass-deep underline underline-offset-2">Back to log in</Link>}>
      {ready && (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <Button type="submit" size="lg" loading={busy}>Save password</Button>
        </form>
      )}
    </AuthShell>
  )
}
