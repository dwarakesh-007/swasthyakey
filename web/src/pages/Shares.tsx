import { KeyRound, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { Badge, Empty, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { formatRemaining, formatWhen, sectionInfo } from '../lib/format'
import { useLiveUpdates, useNow, useShares } from '../lib/hooks'
import type { Share } from '../lib/types'
import { shareState } from './ShareDetail'

export function Shares() {
  const userId = useUserId()
  const now = useNow(15000)
  const { data, loading, reload } = useShares()
  useLiveUpdates(userId, reload)
  if (loading) return <Spinner />
  const standard = data.filter((s) => s.kind === 'standard')
  const active = standard.filter((s) => shareState(s, now) === 'active')
  const past = standard.filter((s) => shareState(s, now) !== 'active')

  return (
    <>
      <PageTitle title="Sharing" body="Every QR code you've made, and who still has access."
        action={<Link to="/share/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brass px-4 font-semibold text-white hover:bg-brass-deep"><Plus className="size-4" aria-hidden />New share</Link>} />

      <h2 className="mb-3 text-lg font-bold">Can see your record now</h2>
      {active.length === 0 ? (
        <Empty icon={<KeyRound className="size-6" />} title="Nobody has access" body="Your record is private. Create a share when you visit a doctor."
          action={<Link to="/share/new" className="inline-flex h-11 items-center rounded-xl border border-line-2 bg-surface px-4 font-semibold hover:border-ink-3">Share with a doctor</Link>} />
      ) : (
        <ul className="flex flex-col gap-2">{active.map((s) => <ShareRow key={s.id} s={s} now={now} />)}</ul>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-bold">Ended</h2>
          <ul className="flex flex-col gap-2">{past.map((s) => <ShareRow key={s.id} s={s} now={now} />)}</ul>
        </>
      )}
    </>
  )
}

function ShareRow({ s, now }: { s: Share; now: number }) {
  const state = shareState(s, now)
  return (
    <li>
      <Link to={`/shares/${s.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-line-2">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${state === 'active' ? 'bg-brass text-white' : 'bg-ink/5 text-ink-3'}`}><KeyRound className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{s.label ?? 'Doctor visit'}</span>
          <span className="block truncate text-sm text-ink-2">{s.sections.map((k) => sectionInfo[k].title).join(', ')}</span>
          <span className="block text-sm text-ink-3">Made {formatWhen(s.created_at)}{s.view_count ? `, opened ${s.view_count}×` : ', not opened'}</span>
        </span>
        {state === 'active' ? <Badge tone="go">{formatRemaining(new Date(s.expires_at!).getTime() - now)} left</Badge>
          : state === 'revoked' ? <Badge tone="stop">Revoked</Badge> : <Badge>Expired</Badge>}
      </Link>
    </li>
  )
}
