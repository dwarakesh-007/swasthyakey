import { Eye, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { Empty, Spinner } from '../components/ui'
import { useUserId } from '../lib/auth'
import { formatTime, sectionInfo } from '../lib/format'
import { useAccessLog, useLiveUpdates, useShares } from '../lib/hooks'
import type { AccessLog } from '../lib/types'

const dayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

export function Activity() {
  const userId = useUserId()
  const log = useAccessLog()
  const shares = useShares()
  useLiveUpdates(userId, () => { log.reload(); shares.reload() })
  if (log.loading || shares.loading) return <Spinner />

  const byId = new Map(shares.data.map((s) => [s.id, s]))
  const days = new Map<string, AccessLog[]>()
  for (const v of log.data) {
    const key = new Date(v.viewed_at).toDateString()
    days.set(key, [...(days.get(key) ?? []), v])
  }

  return (
    <>
      <PageTitle title="Activity" body="Every time someone opened your record. This list cannot be edited or deleted." />
      {log.data.length === 0 ? (
        <Empty icon={<Eye className="size-6" />} title="No one has opened your record" body="When a doctor scans one of your QR codes, it shows up here straight away." />
      ) : (
        <div className="flex flex-col gap-8">
          {[...days.entries()].map(([day, views]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-ink-3">{new Date(day).toDateString() === new Date().toDateString() ? 'Today' : dayFmt.format(new Date(day))}</h2>
              <ol className="flex flex-col gap-2">
                {views.map((v) => {
                  const s = byId.get(v.share_id)
                  const emergency = s?.kind === 'emergency'
                  return (
                    <li key={v.id}>
                      <Link to={`/shares/${v.share_id}`} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-line-2">
                        <span className="tabular w-16 shrink-0 pt-0.5 text-sm font-semibold text-ink-2">{formatTime(v.viewed_at)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 font-semibold">{emergency && <Siren className="size-4 text-stop" aria-hidden />}{emergency ? 'Emergency card scanned' : s?.label ?? 'Doctor visit'}</span>
                          <span className="block text-sm text-ink-2">{v.device ?? 'Unknown device'}</span>
                          <span className="block text-sm text-ink-3">Saw {v.sections.map((k) => sectionInfo[k].title.toLowerCase()).join(', ')}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
