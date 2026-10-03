import { AlertTriangle, ChevronRight, KeyRound, Pill, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { ageFrom, formatRemaining, formatWhen, sexLabel } from '../lib/format'
import { useAccessLog, useAllergies, useLiveUpdates, useMedications, useNow, useProfile, useShares } from '../lib/hooks'
import { shareState } from './ShareDetail'

export function Home() {
  const userId = useUserId()
  const now = useNow(15000)
  const profile = useProfile()
  const allergies = useAllergies()
  const meds = useMedications()
  const shares = useShares()
  const log = useAccessLog(4)
  useLiveUpdates(userId, () => { shares.reload(); log.reload() })

  if (profile.loading || allergies.loading || meds.loading || shares.loading) return <Spinner />
  const p = profile.data
  const age = ageFrom(p?.date_of_birth ?? null)
  const firstName = p?.full_name?.split(' ')[0] || 'there'
  const active = shares.data.filter((s) => s.kind === 'standard' && shareState(s, now) === 'active')
  const currentMeds = meds.data.filter((m) => m.active)
  const emergency = shares.data.find((s) => s.kind === 'emergency' && !s.revoked_at)
  const incomplete = !p?.date_of_birth || !p?.blood_group

  return (
    <>
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-[34px]">Hello, {firstName}</h1>

      {incomplete && (
        <Link to="/profile" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-wait-soft px-4 py-3 font-semibold text-wait">
          Add your date of birth and blood group so doctors see them first <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      {/* the patient's own summary, as a doctor would see it */}
      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-xl font-bold">{p?.full_name || 'Your name'}</p>
            <p className="text-ink-2">{[age !== null && `${age} years`, p?.sex && sexLabel[p.sex]].filter(Boolean).join(', ') || 'Age and sex not added'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-3">Blood group</p>
            <p className="text-3xl leading-none font-bold">{p?.blood_group ?? '–'}</p>
          </div>
        </div>
        <Link to="/records/allergies" className="flex items-start gap-3 border-b border-line p-5 hover:bg-paper">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-stop" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Allergies</p>
            {allergies.data.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allergies.data.map((a) => <Badge key={a.id} tone={a.severity === 'severe' ? 'stop' : a.severity === 'moderate' ? 'wait' : 'neutral'}>{a.substance}</Badge>)}
              </div>
            ) : <p className="text-sm text-ink-3">None added</p>}
          </div>
          <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
        </Link>
        <Link to="/records/medicines" className="flex items-start gap-3 p-5 hover:bg-paper">
          <Pill className="mt-0.5 size-5 shrink-0 text-brass-deep" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Current medicines</p>
            <p className="text-sm text-ink-2">{currentMeds.length ? currentMeds.slice(0, 4).map((m) => m.name).join(', ') + (currentMeds.length > 4 ? ` and ${currentMeds.length - 4} more` : '') : 'None added'}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
        </Link>
      </Card>

      <Link to="/share/new" className="mt-5 flex items-center gap-4 rounded-2xl bg-brass p-5 text-white hover:bg-brass-deep">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/20"><KeyRound className="size-6" aria-hidden /></span>
        <span className="flex-1">
          <span className="block text-lg font-bold">Share with a doctor</span>
          <span className="block text-white">Make a QR code that unlocks only what you choose</span>
        </span>
        <ChevronRight className="size-6" aria-hidden />
      </Link>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Who can see your record</h2>
          <Link to="/shares" className="text-sm font-semibold text-ink-2 underline underline-offset-2">All shares</Link>
        </div>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-ink-2">Nobody. Your record is private right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((s) => (
              <li key={s.id}>
                <Link to={`/shares/${s.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-line-2">
                  <span className="font-semibold">{s.label ?? 'Doctor visit'}</span>
                  <Badge tone="go">{formatRemaining(new Date(s.expires_at!).getTime() - now)} left</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Recently opened</h2>
          <Link to="/activity" className="text-sm font-semibold text-ink-2 underline underline-offset-2">Full activity</Link>
        </div>
        {log.data.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-ink-2">No one has opened your record yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {log.data.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-semibold">{shares.data.find((s) => s.id === v.share_id)?.label ?? 'Doctor visit'}</span>
                <span className="text-ink-3">{formatWhen(v.viewed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!emergency && (
        <Link to="/emergency" className="mt-8 flex items-center gap-3 rounded-2xl border-2 border-stop/30 bg-stop-soft p-4 text-stop">
          <Siren className="size-6 shrink-0" aria-hidden />
          <span className="flex-1 font-semibold">Set up an emergency card for your wallet or lock screen</span>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      )}
    </>
  )
}
