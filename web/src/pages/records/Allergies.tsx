import { AlertTriangle, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Choice, Empty, ErrorNote, Field, Sheet, Spinner, useToast } from '../../components/ui'
import { severityLabel } from '../../lib/format'
import { useAllergies } from '../../lib/hooks'
import { friendlyError, supabase } from '../../lib/supabase'
import type { Allergy, Severity } from '../../lib/types'
import { ItemRow } from './shared'

const tone = { severe: 'stop', moderate: 'wait', mild: 'neutral' } as const

export function Allergies() {
  const { data, loading, reload } = useAllergies()
  const [editing, setEditing] = useState<Allergy | 'new' | null>(null)
  if (loading) return <Spinner />
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-ink-2">Shown first, in red, to any doctor you share with.</p>
        <Button onClick={() => setEditing('new')} size="sm"><Plus className="size-4" aria-hidden />Add allergy</Button>
      </div>
      {data.length === 0 ? (
        <Empty icon={<AlertTriangle className="size-6" />} title="No allergies added" body="If any medicine, food or material has ever caused you a reaction, add it here. If you have none, you can leave this empty."
          action={<Button variant="secondary" onClick={() => setEditing('new')}>Add an allergy</Button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((a) => (
            <ItemRow key={a.id} onClick={() => setEditing(a)} title={a.substance} sub={a.reaction ?? undefined}
              aside={<Badge tone={tone[a.severity]}>{severityLabel[a.severity]}</Badge>} />
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add allergy' : 'Edit allergy'}>
        {editing !== null && <AllergyForm item={editing === 'new' ? null : editing} done={() => { setEditing(null); reload() }} />}
      </Sheet>
    </>
  )
}

function AllergyForm({ item, done }: { item: Allergy | null; done: () => void }) {
  const toast = useToast()
  const [substance, setSubstance] = useState(item?.substance ?? '')
  const [reaction, setReaction] = useState(item?.reaction ?? '')
  const [severity, setSeverity] = useState<Severity>(item?.severity ?? 'moderate')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const row = { substance: substance.trim(), reaction: reaction.trim() || null, severity }
    const { error } = item ? await supabase.from('allergies').update(row).eq('id', item.id) : await supabase.from('allergies').insert(row)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast(item ? 'Allergy updated' : 'Allergy added', 'go')
    done()
  }
  const remove = async () => {
    if (!item || !window.confirm(`Remove ${item.substance} from your allergies?`)) return
    const { error } = await supabase.from('allergies').delete().eq('id', item.id)
    if (error) return setError(friendlyError(error))
    toast('Allergy removed')
    done()
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Allergic to" required maxLength={120} placeholder="Penicillin, peanuts, latex…" value={substance} onChange={(e) => setSubstance(e.target.value)} autoFocus />
      <Field label="What happens (optional)" maxLength={300} placeholder="Rash, swelling, breathing trouble…" value={reaction} onChange={(e) => setReaction(e.target.value)} />
      <Choice<Severity> label="How serious" value={severity} onChange={setSeverity}
        options={[{ value: 'mild', label: 'Mild' }, { value: 'moderate', label: 'Moderate', tone: 'wait' }, { value: 'severe', label: 'Severe', tone: 'stop' }]} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={busy} className="flex-1">{item ? 'Save changes' : 'Add allergy'}</Button>
        {item && <Button type="button" variant="ghost" onClick={remove} className="text-stop">Remove</Button>}
      </div>
    </form>
  )
}
