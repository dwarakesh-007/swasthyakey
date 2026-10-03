import { Camera, Pill, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Empty, ErrorNote, Field, Sheet, Spinner, TextArea, Toggle, useToast } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useMedications } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Medication } from '../../lib/types'
import { ScanPrescription } from './ScanPrescription'
import { ItemRow } from './shared'

export function Medications() {
  const { data, loading, reload } = useMedications()
  const [editing, setEditing] = useState<Medication | 'new' | null>(null)
  const [scanning, setScanning] = useState(false)
  if (loading) return <Spinner />
  const current = data.filter((m) => m.active)
  const past = data.filter((m) => !m.active)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">Only current medicines are shown to doctors.</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setScanning(true)}><Camera className="size-4" aria-hidden />Scan prescription</Button>
          <Button size="sm" onClick={() => setEditing('new')}><Plus className="size-4" aria-hidden />Add</Button>
        </div>
      </div>
      {data.length === 0 ? (
        <Empty icon={<Pill className="size-6" />} title="No medicines added" body="Add what you take now, or photograph a prescription and we'll read the medicines for you."
          action={<Button variant="secondary" onClick={() => setScanning(true)}><Camera className="size-4" aria-hidden />Scan a prescription</Button>} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {current.map((m) => (
              <ItemRow key={m.id} onClick={() => setEditing(m)} title={[m.name, m.dose].filter(Boolean).join(' ')}
                sub={m.frequency ?? undefined} meta={m.notes ?? undefined}
                aside={m.critical ? <Badge tone="stop">Essential</Badge> : undefined} />
            ))}
          </ul>
          {past.length > 0 && (
            <>
              <h3 className="mt-8 mb-2 text-sm font-semibold text-ink-3">Stopped</h3>
              <ul className="flex flex-col gap-2">
                {past.map((m) => <ItemRow key={m.id} muted onClick={() => setEditing(m)} title={m.name} sub={m.dose ?? undefined} />)}
              </ul>
            </>
          )}
        </>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add medicine' : 'Edit medicine'}>
        {editing !== null && <MedicationForm item={editing === 'new' ? null : editing} done={() => { setEditing(null); reload() }} />}
      </Sheet>
      <Sheet open={scanning} onClose={() => setScanning(false)} title="Scan a prescription">
        {scanning && <ScanPrescription done={() => { setScanning(false); reload() }} />}
      </Sheet>
    </>
  )
}

function MedicationForm({ item, done }: { item: Medication | null; done: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: item?.name ?? '', dose: item?.dose ?? '', frequency: item?.frequency ?? '', start_date: item?.start_date ?? '',
    prescribed_by: item?.prescribed_by ?? '', notes: item?.notes ?? '', active: item?.active ?? true, critical: item?.critical ?? false,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const row = {
      name: f.name.trim(), dose: f.dose.trim() || null, frequency: f.frequency.trim() || null, start_date: f.start_date || null,
      prescribed_by: f.prescribed_by.trim() || null, notes: f.notes.trim() || null, active: f.active, critical: f.critical,
    }
    const { error } = item ? await supabase.from('medications').update(row).eq('id', item.id) : await supabase.from('medications').insert(row)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast(item ? 'Medicine updated' : 'Medicine added', 'go')
    done()
  }
  const remove = async () => {
    if (!item || !window.confirm(`Delete ${item.name} from your records? To keep it in your history, switch off "I take this now" instead.`)) return
    const { error } = await supabase.from('medications').delete().eq('id', item.id)
    if (error) return setError(friendlyError(error))
    toast('Medicine deleted')
    done()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Medicine name" required maxLength={120} placeholder="Metformin, Dolo 650…" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dose" maxLength={60} placeholder="500 mg, 1 tablet" value={f.dose} onChange={(e) => set('dose', e.target.value)} />
        <Field label="How often" maxLength={80} placeholder="Twice a day, 1-0-1" value={f.frequency} onChange={(e) => set('frequency', e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Started on" type="date" max={new Date().toISOString().slice(0, 10)} value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
        <Field label="Prescribed by" maxLength={120} placeholder="Dr. name" value={f.prescribed_by} onChange={(e) => set('prescribed_by', e.target.value)} />
      </div>
      <TextArea label="Notes (optional)" maxLength={500} placeholder="After food, for 5 days…" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      <Toggle label="I take this now" hint="Switch off when you stop. It stays in your history." checked={f.active} onChange={(v) => set('active', v)} />
      <Toggle label="Essential medicine" hint="Shown on your emergency card, e.g. insulin, blood thinners, heart or seizure medicines." checked={f.critical} onChange={(v) => set('critical', v)} />
      {item?.created_at && <p className="text-xs text-ink-3">Added {formatDate(item.created_at)}</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={busy} className="flex-1">{item ? 'Save changes' : 'Add medicine'}</Button>
        {item && <Button type="button" variant="ghost" onClick={remove} className="text-stop">Delete</Button>}
      </div>
    </form>
  )
}
