import { HeartPulse, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Choice, Empty, ErrorNote, Field, Sheet, Spinner, TextArea, useToast } from '../../components/ui'
import { conditionStatusLabel, formatDate } from '../../lib/format'
import { useConditions } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Condition, ConditionStatus } from '../../lib/types'
import { ItemRow } from './shared'

export function Conditions() {
  const { data, loading, reload } = useConditions()
  const [editing, setEditing] = useState<Condition | 'new' | null>(null)
  if (loading) return <Spinner />
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-ink-2">Diagnoses you have now or had before.</p>
        <Button onClick={() => setEditing('new')} size="sm"><Plus className="size-4" aria-hidden />Add condition</Button>
      </div>
      {data.length === 0 ? (
        <Empty icon={<HeartPulse className="size-6" />} title="No conditions added" body="Add things like diabetes, blood pressure, asthma, thyroid, or past surgeries."
          action={<Button variant="secondary" onClick={() => setEditing('new')}>Add a condition</Button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((c) => (
            <ItemRow key={c.id} onClick={() => setEditing(c)} title={c.name} muted={c.status === 'resolved'}
              meta={c.diagnosed_on ? `Since ${formatDate(c.diagnosed_on)}` : undefined}
              aside={<Badge tone={c.status === 'active' ? 'wait' : c.status === 'managed' ? 'go' : 'neutral'}>{conditionStatusLabel[c.status]}</Badge>} />
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add condition' : 'Edit condition'}>
        {editing !== null && <ConditionForm item={editing === 'new' ? null : editing} done={() => { setEditing(null); reload() }} />}
      </Sheet>
    </>
  )
}

function ConditionForm({ item, done }: { item: Condition | null; done: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(item?.name ?? '')
  const [diagnosed, setDiagnosed] = useState(item?.diagnosed_on ?? '')
  const [status, setStatus] = useState<ConditionStatus>(item?.status ?? 'active')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const row = { name: name.trim(), diagnosed_on: diagnosed || null, status, notes: notes.trim() || null }
    const { error } = item ? await supabase.from('conditions').update(row).eq('id', item.id) : await supabase.from('conditions').insert(row)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast(item ? 'Condition updated' : 'Condition added', 'go')
    done()
  }
  const remove = async () => {
    if (!item || !window.confirm(`Remove ${item.name}?`)) return
    const { error } = await supabase.from('conditions').delete().eq('id', item.id)
    if (error) return setError(friendlyError(error))
    toast('Condition removed')
    done()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Condition" required maxLength={120} placeholder="Type 2 diabetes, asthma…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Field label="Diagnosed on (optional)" type="date" max={new Date().toISOString().slice(0, 10)} value={diagnosed} onChange={(e) => setDiagnosed(e.target.value)} />
      <Choice<ConditionStatus> label="Status" value={status} onChange={setStatus}
        options={[{ value: 'active', label: 'Ongoing', tone: 'wait' }, { value: 'managed', label: 'Under control', tone: 'go' }, { value: 'resolved', label: 'Recovered' }]} />
      <TextArea label="Notes (optional)" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} hint="Hidden on your emergency card" />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={busy} className="flex-1">{item ? 'Save changes' : 'Add condition'}</Button>
        {item && <Button type="button" variant="ghost" onClick={remove} className="text-stop">Remove</Button>}
      </div>
    </form>
  )
}
