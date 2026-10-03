import { Camera, Check, ImageUp, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, ErrorNote, Toggle, useToast, cx } from '../../components/ui'
import { useUserId } from '../../lib/auth'
import { compressImage, uploadReportFile } from '../../lib/files'
import { parsePrescription, type ParsedMedicine } from '../../lib/prescription'
import { friendlyError, supabase } from '../../lib/supabase'

type Row = ParsedMedicine & { keep: boolean }
type Stage = { step: 'pick' } | { step: 'reading'; progress: number } | { step: 'review'; rows: Row[]; text: string }

export function ScanPrescription({ done }: { done: () => void }) {
  const userId = useUserId()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ step: 'pick' })
  const [savePhoto, setSavePhoto] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showText, setShowText] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const read = async (f: File) => {
    setError(null)
    if (!f.type.startsWith('image/')) return setError('Choose a photo of the prescription (JPG or PNG).')
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setStage({ step: 'reading', progress: 0 })
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        // engine and language data are served from this site (see scripts/copy-ocr.mjs)
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
        logger: (m: { status: string; progress: number }) => m.status === 'recognizing text' && setStage({ step: 'reading', progress: m.progress }),
      })
      const small = await compressImage(f, 2000, 0.9)
      const { data } = await worker.recognize(small)
      await worker.terminate()
      setStage({ step: 'review', text: data.text, rows: parsePrescription(data.text).map((r) => ({ ...r, keep: true })) })
    } catch (e) {
      setStage({ step: 'pick' })
      setError(`Could not read the photo. ${friendlyError(e)}`)
    }
  }

  const reset = () => { setFile(null); setPreview(null); setStage({ step: 'pick' }); setError(null) }

  const save = async () => {
    if (stage.step !== 'review') return
    const keep = stage.rows.filter((r) => r.keep && r.name.trim())
    setBusy(true)
    setError(null)
    try {
      if (keep.length) {
        const { error } = await supabase.from('medications').insert(
          keep.map((r) => ({ name: r.name.trim().slice(0, 120), dose: r.dose?.trim() || null, frequency: r.frequency?.trim() || null, notes: r.notes?.trim() || null, active: true, critical: false })),
          { defaultToNull: false },
        )
        if (error) throw error
      }
      if (savePhoto && file) {
        const meta = await uploadReportFile(userId, file)
        const { error } = await supabase.from('reports').insert({ title: 'Prescription', kind: 'prescription', report_date: new Date().toISOString().slice(0, 10), ...meta })
        if (error) throw error
      }
      toast(keep.length ? `${keep.length} medicine${keep.length > 1 ? 's' : ''} added` : 'Prescription photo saved', 'go')
      done()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const update = (i: number, patch: Partial<Row>) =>
    stage.step === 'review' && setStage({ ...stage, rows: stage.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

  return (
    <div className="flex flex-col gap-4">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />

      {stage.step === 'pick' && (
        <>
          <p className="text-ink-2">Take a clear photo in good light, with the whole prescription in the frame. Printed prescriptions read best; for handwriting, check every medicine before saving.</p>
          <Button size="lg" onClick={() => { if (input.current) { input.current.setAttribute('capture', 'environment'); input.current.click() } }}><Camera className="size-5" aria-hidden />Take a photo</Button>
          <Button variant="secondary" onClick={() => { if (input.current) { input.current.removeAttribute('capture'); input.current.click() } }}><ImageUp className="size-4" aria-hidden />Choose from gallery</Button>
        </>
      )}

      {preview && <img src={preview} alt="Your prescription photo" className="max-h-56 w-full rounded-xl border border-line object-contain bg-paper" />}

      {stage.step === 'reading' && (
        <div role="status" className="flex flex-col gap-2">
          <p className="font-semibold">Reading the prescription…</p>
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brass transition-[width]" style={{ width: `${Math.round(stage.progress * 100)}%` }} /></div>
          <p className="text-sm text-ink-3">This runs on your phone. The photo is not sent anywhere while reading.</p>
        </div>
      )}

      {stage.step === 'review' && (
        <>
          {stage.rows.length === 0 ? (
            <ErrorNote>No medicines found in this photo. Try a sharper photo, or add them by hand.</ErrorNote>
          ) : (
            <>
              <p className="font-semibold">Found {stage.rows.length} medicine{stage.rows.length > 1 ? 's' : ''}. Check each one, fix anything wrong, and untick any that are not right.</p>
              <ul className="flex flex-col gap-3">
                {stage.rows.map((r, i) => (
                  <li key={i} className={cx('rounded-2xl border p-3 transition-opacity', r.keep ? 'border-line-2 bg-surface' : 'border-line bg-paper opacity-60')}>
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => update(i, { keep: !r.keep })} aria-pressed={r.keep} aria-label={r.keep ? `Don't add ${r.name}` : `Add ${r.name}`}
                        className={cx('mt-1 grid size-6 shrink-0 place-items-center rounded-md border-2', r.keep ? 'border-go bg-go text-white' : 'border-line-2')}>
                        {r.keep && <Check className="size-4" aria-hidden />}
                      </button>
                      <div className="grid flex-1 gap-2">
                        <input aria-label="Medicine name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="h-10 rounded-lg border border-line-2 px-2.5 font-semibold" />
                        <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                          <input aria-label="Dose" placeholder="Dose" value={r.dose ?? ''} onChange={(e) => update(i, { dose: e.target.value })} className="h-10 rounded-lg border border-line-2 px-2.5 text-sm" />
                          <input aria-label="How often" placeholder="How often" value={r.frequency ?? ''} onChange={(e) => update(i, { frequency: e.target.value })} className="h-10 rounded-lg border border-line-2 px-2.5 text-sm" />
                        </div>
                        {r.notes && <p className="text-sm text-ink-2">{r.notes}</p>}
                        <p className="truncate text-xs text-ink-3" title={r.source}>Read as: {r.source}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="self-start text-sm font-semibold text-ink-2 underline underline-offset-2" onClick={() => setShowText(!showText)}>{showText ? 'Hide' : 'Show'} all text we read</button>
          {showText && <pre className="max-h-48 overflow-auto rounded-xl bg-paper p-3 text-xs whitespace-pre-wrap text-ink-2">{stage.text || '(nothing readable)'}</pre>}
          <Toggle label="Also save the photo to Reports" hint="Keeps the original prescription with your records." checked={savePhoto} onChange={setSavePhoto} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} className="flex-1" disabled={!stage.rows.some((r) => r.keep) && !savePhoto}>
              {stage.rows.some((r) => r.keep) ? `Add ${stage.rows.filter((r) => r.keep).length} medicine${stage.rows.filter((r) => r.keep).length > 1 ? 's' : ''}` : 'Save photo only'}
            </Button>
            <Button variant="ghost" onClick={reset}><RotateCcw className="size-4" aria-hidden />Retake</Button>
          </div>
        </>
      )}
      {stage.step !== 'review' && error && <ErrorNote>{error}</ErrorNote>}
    </div>
  )
}
