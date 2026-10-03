import { FolderHeart, QrCode, ShieldOff, Smartphone } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { KeyTag } from '../components/KeyTag'
import { Logo } from '../components/Layout'
import { useAuth } from '../lib/auth'
import { useNow } from '../lib/hooks'

const DEMO_MS = 30 * 60_000

export function Landing() {
  const { session } = useAuth()
  const now = useNow()
  if (session) return <Navigate to="/home" replace />
  // a looping half-hour countdown so the tag on the page ticks like the real one
  const msLeft = DEMO_MS - (now % DEMO_MS)

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-2">
          <Link to="/login" className="h-10 whitespace-nowrap rounded-xl px-3 leading-10 font-semibold text-ink-2 hover:bg-ink/5 sm:px-4">Log in</Link>
          <Link to="/signup" className="h-10 whitespace-nowrap rounded-xl bg-ink px-3 leading-10 font-semibold text-white hover:bg-ink-2 sm:px-4">Sign up</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 md:grid-cols-[1.15fr_1fr] md:px-8 md:pt-16">
        <div>
          <h1 className="text-[40px] leading-[1.05] font-bold tracking-tight md:text-[60px]">
            Your health history, on your phone. Opened only when you say so.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg text-ink-2">
            Keep your allergies, medicines and reports in one place. At any clinic, show a QR code that unlocks only what you choose, for as long as you choose. Take it back with one tap.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex h-14 items-center rounded-xl bg-brass px-6 text-base font-semibold text-white hover:bg-brass-deep">Create your free record</Link>
            <Link to="/login" className="inline-flex h-14 items-center rounded-xl border border-line-2 bg-surface px-6 text-base font-semibold hover:border-ink-3">I have an account</Link>
          </div>
        </div>
        <div className="pointer-events-none select-none" aria-hidden>
          <KeyTag url="https://swasthyakey.example/v/demo" title="Dr. Rao, City Clinic" subtitle="Allergies and current medicines" remaining={msLeft / DEMO_MS} msLeft={msLeft} state="active" />
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-8">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">How a visit works</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { icon: FolderHeart, t: 'Keep your records', b: 'Add allergies, medicines and conditions. Photograph old prescriptions and reports instead of carrying files.' },
              { icon: QrCode, t: 'Show the code', b: 'Pick what the doctor should see and for how long. They scan it with their phone camera and read a one-page summary.' },
              { icon: ShieldOff, t: 'Take it back', b: 'Tap revoke and their screen locks at once. Every view is logged so you always know who opened your record.' },
            ].map(({ icon: Icon, t, b }, i) => (
              <li key={t} className="flex gap-4">
                <span className="tabular grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="flex items-center gap-2 text-lg font-bold"><Icon className="size-5 text-brass-deep" aria-hidden />{t}</p>
                  <p className="mt-1 text-ink-2">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:px-8">
        <div className="flex gap-4">
          <Smartphone className="mt-1 size-6 shrink-0 text-brass-deep" aria-hidden />
          <div>
            <h2 className="text-xl font-bold">For doctors and clinics</h2>
            <p className="mt-1 text-ink-2">Nothing to install and no login. Any phone camera opens the summary in the browser, with allergies shown first.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <ShieldOff className="mt-1 size-6 shrink-0 text-brass-deep" aria-hidden />
          <div>
            <h2 className="text-xl font-bold">Private by default</h2>
            <p className="mt-1 text-ink-2">Nobody, including us, sees your record unless you share it. Shares end on their own, and report files lock the moment access ends.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-4 py-8 text-center text-sm text-ink-3">
        SwasthyaKey is built by team Shouryangas, VJIT Hyderabad. Not a replacement for your doctor's advice.
      </footer>
    </div>
  )
}
