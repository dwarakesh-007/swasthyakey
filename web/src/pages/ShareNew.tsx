import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { Button, Choice, ErrorNote, Field, cx } from '../components/ui'
import { SECTION_ORDER, formatDuration, sectionInfo } from '../lib/format'
import { friendlyError, supabase } from '../lib/supabase'
import type { SectionKey, Share } from '../lib/types'

const DURATIONS = [15, 30, 60, 1440, 10080]

export function ShareNew() {
  const navigate = useNavigate()
  const [sections, setSections] = useState<Set<SectionKey>>(new Set(['allergies', 'medications']))
  const [minutes, setMinutes] = useState(30)
  const [label, setLabel] = useState('')
  const [counts, setCounts] = useState<Partial<Record<SectionKey, number | string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const count = (t: string, filter?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let q = supabase.from(t).select('id', { count: 'exact', head: true })
      if (filter) q = filter(q)
      return q.then((r: { count: number | null }) => r.count ?? 0)
    }
    Promise.all([
      count('allergies'),
      count('medications', (q) => q.eq('active', true)),
      count('conditions'),
      count('reports'),
      supabase.from('profiles').select('emergency_contact_name').maybeSingle().then((r) => (r.data?.emergency_contact_name ? 1 : 0)),
    ]).then(([a, m, c, r, e]) => setCounts({ allergies: a, medications: m, conditions: c, reports: r, emergency_contact: e }))
  }, [])

  const toggle = (k: SectionKey) => {
    const next = new Set(sections)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    setSections(next)
  }

  const create = async () => {
    if (sections.size === 0) return setError('Pick at least one thing to share.')
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_share', { p_sections: [...sections], p_minutes: minutes, p_label: label.trim() || null })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    navigate(`/shares/${(data as Share).id}`, { replace: true })
  }

  const countLabel = (k: SectionKey) => {
    const n = counts[k]
    if (n === undefined) return ''
    if (k === 'emergency_contact') return n ? 'Added' : 'Not added yet'
    return n === 0 ? 'Nothing added yet' : `${n} item${n === 1 ? '' : 's'}`
  }

  return (
    <>
      <PageTitle title="Share with a doctor" body="Your name, age, sex and blood group are always included. Choose what else they can see." />
      <section aria-labelledby="what" className="mb-8">
        <h2 id="what" className="mb-3 text-lg font-bold">What they can see</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SECTION_ORDER.map((k) => {
            const on = sections.has(k)
            return (
              <li key={k}>
                <button type="button" aria-pressed={on} onClick={() => toggle(k)}
                  className={cx('flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors', on ? 'border-go bg-go-soft' : 'border-line bg-surface hover:border-line-2')}>
                  <span className={cx('mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2', on ? 'border-go bg-go text-white' : 'border-line-2 bg-surface')}>
                    {on && <Check className="size-4" aria-hidden />}
                  </span>
                  <span>
                    <span className="block font-semibold">{sectionInfo[k].title}</span>
                    <span className="block text-sm text-ink-2">{sectionInfo[k].hint}</span>
                    <span className={cx('mt-1 block text-xs font-semibold', counts[k] === 0 ? 'text-wait' : 'text-ink-3')}>{countLabel(k)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mb-8 flex flex-col gap-5">
        <Choice<number> label="For how long" value={minutes} onChange={setMinutes} options={DURATIONS.map((d) => ({ value: d, label: formatDuration(d) }))} />
        <Field label="Who is this for? (optional)" maxLength={80} placeholder="Dr. Rao, City Clinic" value={label} onChange={(e) => setLabel(e.target.value)} hint="Helps you recognise it in your activity log" />
      </section>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      <Button size="lg" variant="brass" onClick={create} loading={busy} className="w-full sm:w-auto">Create QR code</Button>
      <p className="mt-3 text-sm text-ink-3">It locks by itself after {formatDuration(minutes)}. You can revoke it sooner.</p>
    </>
  )
}
