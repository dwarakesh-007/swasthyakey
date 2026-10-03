import { FileText, Image as ImageIcon, Paperclip, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Empty, ErrorNote, Field, SelectField, Sheet, Spinner, TextArea, useToast } from '../../components/ui'
import { useUserId } from '../../lib/auth'
import { checkFile, openFile, uploadReportFile } from '../../lib/files'
import { formatDate, humanFileSize, reportKindLabel } from '../../lib/format'
import { useReports } from '../../lib/hooks'
import { friendlyError, REPORTS_BUCKET, supabase } from '../../lib/supabase'
import type { Report, ReportKind } from '../../lib/types'
import { ItemRow } from './shared'

export function Reports() {
  const { data, loading, reload } = useReports()
  const [editing, setEditing] = useState<Report | 'new' | null>(null)
  if (loading) return <Spinner />
  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-ink-2">Lab results, scans, discharge papers.</p>
        <Button onClick={() => setEditing('new')} size="sm"><Plus className="size-4" aria-hidden />Add report</Button>
      </div>
      {data.length === 0 ? (
        <Empty icon={<FileText className="size-6" />} title="No reports yet" body="Photograph or upload lab reports and scans so a doctor can see them without you carrying the file."
          action={<Button variant="secondary" onClick={() => setEditing('new')}>Upload a report</Button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((r) => (
            <ItemRow key={r.id} onClick={() => setEditing(r)} title={r.title}
              sub={reportKindLabel[r.kind]} meta={r.report_date ? formatDate(r.report_date) : undefined}
              aside={r.file_path ? <Badge>{r.mime_type === 'application/pdf' ? <FileText className="size-3" aria-hidden /> : <ImageIcon className="size-3" aria-hidden />}{r.mime_type === 'application/pdf' ? 'PDF' : 'Photo'}</Badge> : undefined} />
          ))}
        </ul>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add report' : 'Report'}>
        {editing !== null && <ReportForm item={editing === 'new' ? null : editing} done={() => { setEditing(null); reload() }} />}
      </Sheet>
    </>
  )
}

function ReportForm({ item, done }: { item: Report | null; done: () => void }) {
  const userId = useUserId()
  const toast = useToast()
  const [title, setTitle] = useState(item?.title ?? '')
  const [kind, setKind] = useState<ReportKind>(item?.kind ?? 'lab')
  const [date, setDate] = useState(item?.report_date ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = (f: File | undefined) => {
    if (!f) return
    const problem = f.size > 25 * 1024 * 1024 ? 'File is too large. Upload a file under 10 MB.' : f.type.startsWith('image/') ? null : checkFile(f)
    setError(problem)
    if (!problem) {
      setFile(f)
      if (!title) setTitle(f.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' ').slice(0, 160))
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let fileMeta = {}
      if (file) fileMeta = await uploadReportFile(userId, file)
      const row = { title: title.trim(), kind, report_date: date || null, notes: notes.trim() || null, ...fileMeta }
      const { error } = item ? await supabase.from('reports').update(row).eq('id', item.id) : await supabase.from('reports').insert(row)
      if (error) throw error
      if (file && item?.file_path) await supabase.storage.from(REPORTS_BUCKET).remove([item.file_path])
      toast(item ? 'Report updated' : 'Report added', 'go')
      done()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!item || !window.confirm(`Delete "${item.title}" and its file?`)) return
    const { error } = await supabase.from('reports').delete().eq('id', item.id)
    if (error) return setError(friendlyError(error))
    if (item.file_path) await supabase.storage.from(REPORTS_BUCKET).remove([item.file_path])
    toast('Report deleted')
    done()
  }

  const open = async () => {
    if (!item?.file_path) return
    try { await openFile(supabase, item.file_path, item.file_name) } catch (e) { setError(friendlyError(e)) }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {item?.file_path && (
        <button type="button" onClick={open} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3 text-left hover:border-line-2">
          <Paperclip className="size-5 text-brass-deep" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{item.file_name ?? 'Attached file'}</span>
            <span className="text-sm text-ink-3">Tap to open{item.size_bytes ? `, ${humanFileSize(item.size_bytes)}` : ''}</span>
          </span>
        </button>
      )}
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line-2 px-4 py-5 text-center hover:border-brass focus-within:border-brass">
        <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <Paperclip className="size-5 text-brass-deep" aria-hidden />
        <span className="font-semibold">{file ? file.name : item?.file_path ? 'Replace the file' : 'Choose a photo or PDF'}</span>
        <span className="text-sm text-ink-3">{file ? humanFileSize(file.size) : 'Up to 10 MB. Photos are resized automatically.'}</span>
      </label>
      <Field label="Title" required maxLength={160} placeholder="Blood test, chest X-ray…" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
          {Object.entries(reportKindLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <Field label="Date of report" type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <TextArea label="Key findings (optional)" maxLength={1000} placeholder="HbA1c 7.2%, Hb 11.8…" value={notes} onChange={(e) => setNotes(e.target.value)} hint="Doctors see this next to the file" />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={busy} className="flex-1">{item ? 'Save changes' : 'Add report'}</Button>
        {item && <Button type="button" variant="ghost" onClick={remove} className="text-stop">Delete</Button>}
      </div>
    </form>
  )
}
