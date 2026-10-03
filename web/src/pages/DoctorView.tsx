import { AlertTriangle, Clock, FileText, HeartPulse, Lock, Phone, Pill, Printer, Siren, UserRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Logo } from '../components/Layout'
import { Badge, Spinner, cx } from '../components/ui'
import { openFile } from '../lib/files'
import { conditionStatusLabel, describeDevice, formatClock, formatDate, formatRemaining, reportKindLabel, sectionInfo, severityLabel, sexLabel, SECTION_ORDER } from '../lib/format'
import { useNow } from '../lib/hooks'
import { viewerClient } from '../lib/supabase'
import type { SectionKey, SharedRecord, ShareStatus } from '../lib/types'

type Active = Extract<SharedRecord, { status: 'active' }>
type Ended = 'revoked' | 'expired' | 'not_found' | 'error'

const POLL_MS = 4000

export function DoctorView() {
  const { token = '' } = useParams()
  const client = useMemo(() => viewerClient(token), [token])
  const [record, setRecord] = useState<Active | null>(null)
  const [ended, setEnded] = useState<Ended | null>(null)
  const [offset, setOffset] = useState(0) // server clock minus this device's clock
  const opened = useRef<string | null>(null)
  const now = useNow(1000) + offset

  // Lock the page: patient data is dropped from memory, not just hidden.
  const lock = useCallback((why: Ended) => {
    setRecord(null)
    setEnded(why)
  }, [])

  useEffect(() => {
    document.title = 'Shared health record'
    if (opened.current === token) return
    opened.current = token
    client.rpc('open_share', { p_token: token, p_device: describeDevice(navigator.userAgent) }).then(({ data, error }) => {
      if (error || !data) return lock('error')
      const r = data as SharedRecord
      if (r.status !== 'active') return lock(r.status)
      setOffset(new Date(r.server_time).getTime() - Date.now())
      setRecord(r)
    })
  }, [client, token, lock])

  // Stay in sync with the patient: poll, re-check when the tab comes back, and listen for an instant "revoked" ping.
  useEffect(() => {
    if (!record) return
    const check = async () => {
      const { data } = await client.rpc('share_status', { p_token: token })
      const s = data as ShareStatus | null
      if (s && s.status !== 'active') lock(s.status)
    }
    const id = window.setInterval(check, POLL_MS)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    const channel = client.channel(`share-${token}`).on('broadcast', { event: 'changed' }, check).subscribe()
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      client.removeChannel(channel)
    }
  }, [record, client, token, lock])

  const expiresAt = record?.expires_at ? new Date(record.expires_at).getTime() : null
  useEffect(() => {
    if (record && expiresAt !== null && now >= expiresAt) lock('expired')
  }, [now, expiresAt, record, lock])

  if (ended) return <Locked why={ended} />
  if (!record) return <div className="min-h-dvh bg-paper"><Spinner label="Opening record" /></div>

  const emergency = record.kind === 'emergency'
  const msLeft = expiresAt !== null ? expiresAt - now : null
  const p = record.patient
  const notShared = SECTION_ORDER.filter((k) => !record.sections.includes(k) && !(emergency && k === 'reports'))

  return (
    <div className="min-h-dvh bg-paper">
      <header className={cx('no-print sticky top-0 z-10 border-b', emergency ? 'border-stop bg-stop text-white' : 'border-line bg-surface')}>
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          {emergency ? <span className="flex items-center gap-2 font-bold"><Siren className="size-5" aria-hidden />Emergency information</span> : <Logo />}
          {msLeft !== null ? (
            <span className={cx('tabular inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', msLeft < 120_000 ? 'bg-stop-soft text-stop' : 'bg-go-soft text-go')}>
              <Clock className="size-4" aria-hidden />{msLeft < 3_600_000 ? formatClock(msLeft) : formatRemaining(msLeft)} left
            </span>
          ) : <span className="text-sm font-semibold">Read-only</span>}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-ink-3">{emergency ? 'From the patient\'s emergency card.' : `Shared by the patient${record.label ? ` for ${record.label}` : ''}. Read-only.`}</p>

        <section aria-label="Patient" className="mt-2 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">{p.full_name || 'Name not given'}</h1>
            <p className="text-lg text-ink-2">{[p.age !== null && `${p.age} years`, p.sex && sexLabel[p.sex]].filter(Boolean).join(', ') || 'Age and sex not given'}</p>
            {p.abha_number && <p className="mt-1 text-sm text-ink-3">ABHA {p.abha_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-3">Blood group</p>
            <p className="text-4xl leading-none font-bold text-stop">{p.blood_group ?? '?'}</p>
          </div>
        </section>

        {record.allergies && (
          <section aria-labelledby="allergies" className={cx('mt-4 rounded-2xl p-5', record.allergies.length ? 'border-2 border-stop bg-stop-soft' : 'border border-line bg-surface')}>
            <h2 id="allergies" className={cx('flex items-center gap-2 text-lg font-bold', record.allergies.length > 0 && 'text-stop')}>
              <AlertTriangle className="size-5" aria-hidden />{record.allergies.length ? `Allergies (${record.allergies.length})` : 'Allergies'}
            </h2>
            {record.allergies.length === 0 ? (
              <p className="mt-1 text-ink-2">The patient has not recorded any allergies.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {record.allergies.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-surface px-4 py-3">
                    <span>
                      <span className="text-lg font-bold">{a.substance}</span>
                      {a.reaction && <span className="block text-ink-2">{a.reaction}</span>}
                    </span>
                    <Badge tone={a.severity === 'severe' ? 'stop' : a.severity === 'moderate' ? 'wait' : 'neutral'}>{severityLabel[a.severity]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {record.medications && (
          <Block id="meds" icon={<Pill className="size-5 text-brass-deep" />} title={emergency ? 'Essential medicines' : 'Current medicines'} count={record.medications.length}
            empty={emergency ? 'No essential medicines marked.' : 'No current medicines recorded.'}>
            <ul className="divide-y divide-line">
              {record.medications.map((m, i) => (
                <li key={i} className="py-3 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{m.name}{m.dose && <span className="font-normal text-ink-2">{m.dose}</span>}{m.critical && !emergency && <Badge tone="stop">Essential</Badge>}</p>
                  {m.frequency && <p className="text-ink-2">{m.frequency}</p>}
                  {(m.notes || m.prescribed_by || m.start_date) && (
                    <p className="text-sm text-ink-3">{[m.notes, m.prescribed_by && `Prescribed by ${m.prescribed_by}`, m.start_date && `since ${formatDate(m.start_date)}`].filter(Boolean).join('. ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {record.conditions && (
          <Block id="conds" icon={<HeartPulse className="size-5 text-brass-deep" />} title="Health conditions" count={record.conditions.length} empty="No conditions recorded.">
            <ul className="divide-y divide-line">
              {record.conditions.map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <span>
                    <span className={cx('font-semibold', c.status === 'resolved' && 'text-ink-2')}>{c.name}</span>
                    {c.diagnosed_on && <span className="block text-sm text-ink-3">Since {formatDate(c.diagnosed_on)}</span>}
                    {c.notes && <span className="block text-sm text-ink-2">{c.notes}</span>}
                  </span>
                  <Badge tone={c.status === 'active' ? 'wait' : c.status === 'managed' ? 'go' : 'neutral'}>{conditionStatusLabel[c.status]}</Badge>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {record.reports && (
          <Block id="reports" icon={<FileText className="size-5 text-brass-deep" />} title="Reports & documents" count={record.reports.length} empty="No reports uploaded.">
            <ul className="divide-y divide-line">
              {record.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{r.title}</span>
                    <span className="block text-sm text-ink-3">{reportKindLabel[r.kind]}{r.report_date ? `, ${formatDate(r.report_date)}` : ''}</span>
                    {r.notes && <span className="mt-1 block text-ink-2">{r.notes}</span>}
                  </span>
                  {r.file_path && <OpenFile onOpen={() => openFile(client, r.file_path!, r.file_name)} pdf={r.mime_type === 'application/pdf'} />}
                </li>
              ))}
            </ul>
          </Block>
        )}

        {record.emergency_contact && (
          <Block id="contact" icon={<UserRound className="size-5 text-brass-deep" />} title="Emergency contact" count={null} empty="">
            {record.emergency_contact.phone ? (
              <a href={`tel:${record.emergency_contact.phone.replace(/[^\d+]/g, '')}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper p-4 hover:bg-go-soft">
                <span>
                  <span className="block font-semibold">{record.emergency_contact.name ?? 'Family'}{record.emergency_contact.relation ? ` (${record.emergency_contact.relation})` : ''}</span>
                  <span className="tabular block text-lg">{record.emergency_contact.phone}</span>
                </span>
                <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-go px-4 font-semibold text-white"><Phone className="size-4" aria-hidden />Call</span>
              </a>
            ) : <p className="text-ink-2">Not given.</p>}
          </Block>
        )}

        {notShared.length > 0 && (
          <p className="mt-4 rounded-2xl border border-dashed border-line-2 px-5 py-4 text-sm text-ink-2">
            Not shared by the patient: {notShared.map((k: SectionKey) => sectionInfo[k].title.toLowerCase()).join(', ')}. Ask them if you need it.
          </p>
        )}

        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3">
          <p>Patient-entered information. Confirm important details with the patient.</p>
          <button onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-2 bg-surface px-3 font-semibold text-ink hover:border-ink-3"><Printer className="size-4" aria-hidden />Print</button>
        </div>
        <p className="mt-3 text-xs text-ink-3">The patient can see that this record was opened on {describeDevice(navigator.userAgent)}.</p>
      </main>
    </div>
  )
}

function Block({ id, icon, title, count, empty, children }: { id: string; icon: ReactNode; title: string; count: number | null; empty: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <h2 id={id} className="mb-3 flex items-center gap-2 text-lg font-bold">{icon}{title}{count ? <span className="font-normal text-ink-3">({count})</span> : null}</h2>
      {count === 0 ? <p className="text-ink-2">{empty}</p> : children}
    </section>
  )
}

function OpenFile({ onOpen, pdf }: { onOpen: () => Promise<void>; pdf: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  return (
    <button
      onClick={async () => { setState('busy'); try { await onOpen(); setState('idle') } catch { setState('error') } }}
      className={cx('inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold', state === 'error' ? 'bg-stop-soft text-stop' : 'bg-ink text-white hover:bg-ink-2')}
    >
      <FileText className="size-4" aria-hidden />{state === 'busy' ? 'Opening…' : state === 'error' ? 'Access ended' : pdf ? 'Open PDF' : 'View photo'}
    </button>
  )
}

function Locked({ why }: { why: Ended }) {
  const text: Record<Ended, [string, string]> = {
    revoked: ['Access revoked', 'The patient has taken back access to this record. Ask them to share again if you still need it.'],
    expired: ['Access ended', 'The time the patient allowed has run out. Ask them to share again if you still need it.'],
    not_found: ['Link not valid', 'This QR code does not open any record. Check that you scanned the full code.'],
    error: ['Could not open the record', 'Check your internet connection and scan the code again.'],
  }
  useEffect(() => { document.title = text[why][0] })
  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-white" role="alert">
      <div className="max-w-sm">
        <span className="mx-auto grid size-20 animate-[lock-in_.35s_ease-out] place-items-center rounded-full bg-white text-ink"><Lock className="size-9" aria-hidden /></span>
        <h1 className="mt-6 text-3xl font-bold">{text[why][0]}</h1>
        <p className="mt-3 text-lg text-white/80">{text[why][1]}</p>
        <p className="mt-10 text-sm text-white/50">SwasthyaKey: patient-controlled health records</p>
      </div>
    </div>
  )
}
