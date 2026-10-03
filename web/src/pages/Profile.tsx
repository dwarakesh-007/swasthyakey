import { Download } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { Button, Card, Choice, ErrorNote, Field, SelectField, Spinner, useToast } from '../components/ui'
import { useUserId } from '../lib/auth'
import { useProfile } from '../lib/hooks'
import { friendlyError, supabase } from '../lib/supabase'
import type { BloodGroup, Profile as P, Sex } from '../lib/types'

const BLOOD: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// 14 digits typed any way → 12-3456-7890-1234
function formatAbha(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10, 14)].filter(Boolean).join('-')
}

export function Profile() {
  const userId = useUserId()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1'
  const { data, loading } = useProfile()
  const [form, setForm] = useState<P | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => { if (data) setForm(data) }, [data])
  if (loading || !form) return <Spinner />

  const set = <K extends keyof P>(k: K, v: P[K]) => setForm({ ...form, [k]: v })
  const blank = (v: string | null) => (v && v.trim() ? v.trim() : null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (form.abha_number && !/^\d{2}-\d{4}-\d{4}-\d{4}$/.test(form.abha_number)) return setError('ABHA number has 14 digits, like 12-3456-7890-1234.')
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      date_of_birth: form.date_of_birth || null,
      sex: form.sex,
      blood_group: form.blood_group,
      phone: blank(form.phone),
      abha_number: blank(form.abha_number),
      emergency_contact_name: blank(form.emergency_contact_name),
      emergency_contact_phone: blank(form.emergency_contact_phone),
      emergency_contact_relation: blank(form.emergency_contact_relation),
    }).eq('id', userId)
    setBusy(false)
    if (error) return setError(friendlyError(error))
    toast('Details saved', 'go')
    if (welcome) navigate('/home')
  }

  const exportData = async () => {
    setExporting(true)
    const [profile, allergies, medications, conditions, reports, shares, access] = await Promise.all(
      ['profiles', 'allergies', 'medications', 'conditions', 'reports', 'shares', 'access_logs'].map((t) => supabase.from(t).select('*')),
    )
    const blob = new Blob([JSON.stringify({
      exported_at: new Date().toISOString(),
      profile: profile.data?.[0], allergies: allergies.data, medications: medications.data, conditions: conditions.data,
      reports: reports.data, shares: shares.data?.map(({ token: _t, ...s }) => s), access_log: access.data,
    }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `swasthyakey-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setExporting(false)
  }

  return (
    <>
      <PageTitle title={welcome ? 'Welcome! Start with your basics' : 'My details'} body={welcome ? 'A doctor sees these at the top of everything you share. You can change them any time.' : 'Shown at the top of every record you share.'} />
      <form onSubmit={save} className="flex flex-col gap-8">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-lg font-bold">About you</h2>
          <Field label="Full name" required maxLength={120} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value || null)} />
            <SelectField label="Blood group" value={form.blood_group ?? ''} onChange={(e) => set('blood_group', (e.target.value || null) as BloodGroup | null)}>
              <option value="">Not known</option>
              {BLOOD.map((b) => <option key={b}>{b}</option>)}
            </SelectField>
          </div>
          <Choice<Sex | ''> label="Sex" value={form.sex ?? ''} onChange={(v) => set('sex', (v || null) as Sex | null)}
            options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }]} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" type="tel" autoComplete="tel" maxLength={20} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            <Field label="ABHA number (optional)" inputMode="numeric" placeholder="12-3456-7890-1234" value={form.abha_number ?? ''} onChange={(e) => set('abha_number', formatAbha(e.target.value))} hint="Your national health ID, if you have one" />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-lg font-bold">Emergency contact</h2>
            <p className="text-sm text-ink-3">Shown on your emergency card so someone can call your family.</p>
          </div>
          <Field label="Name" maxLength={120} value={form.emergency_contact_name ?? ''} onChange={(e) => set('emergency_contact_name', e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" type="tel" maxLength={20} value={form.emergency_contact_phone ?? ''} onChange={(e) => set('emergency_contact_phone', e.target.value)} />
            <Field label="Relation" placeholder="Son, wife, friend…" maxLength={40} value={form.emergency_contact_relation ?? ''} onChange={(e) => set('emergency_contact_relation', e.target.value)} />
          </div>
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="sticky bottom-20 z-10 md:bottom-4">
          <Button type="submit" size="lg" loading={busy} className="w-full shadow-lg sm:w-auto">{welcome ? 'Save and continue' : 'Save details'}</Button>
        </div>
      </form>

      {!welcome && (
        <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-bold">Your data belongs to you</h2>
            <p className="text-sm text-ink-3">Download everything in your record as a file.</p>
          </div>
          <Button variant="secondary" onClick={exportData} loading={exporting}><Download className="size-4" aria-hidden />Download my data</Button>
        </Card>
      )}
    </>
  )
}
