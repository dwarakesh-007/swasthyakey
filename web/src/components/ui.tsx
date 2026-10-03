import { Loader2, X } from 'lucide-react'
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brass'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2 disabled:bg-ink-3',
  brass: 'bg-brass text-white hover:bg-brass-deep disabled:opacity-60',
  secondary: 'bg-surface text-ink border border-line-2 hover:border-ink-3 disabled:text-ink-3',
  danger: 'bg-stop text-white hover:bg-[#912018] disabled:opacity-60',
  ghost: 'text-ink-2 hover:bg-ink/5 disabled:text-ink-3',
}

export function Button({
  variant = 'primary', size = 'md', loading, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,transform] active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-14 px-6 text-base',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

function FieldShell({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="text-sm text-stop">{error}</p> : hint ? <p id={`${id}-hint`} className="text-sm text-ink-3">{hint}</p> : null}
    </div>
  )
}

const inputCls = 'h-11 w-full rounded-xl border border-line-2 bg-surface px-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-brass aria-invalid:border-stop'

export function Field({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} className={inputCls} {...rest} />
    </FieldShell>
  )
}

export function SelectField({ label, hint, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} className={cx(inputCls, 'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2366728a%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[position:right_12px_center] bg-no-repeat pr-9')} {...rest}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextArea({ label, hint, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea id={id} rows={3} className={cx(inputCls, 'h-auto py-2.5')} {...rest} />
    </FieldShell>
  )
}

// Choice chips for small fixed option sets (severity, status, duration)
export function Choice<T extends string | number>({
  label, value, options, onChange,
}: { label: string; value: T; options: { value: T; label: string; tone?: 'stop' | 'wait' | 'go' }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              type="button" key={String(o.value)} aria-pressed={on} onClick={() => onChange(o.value)}
              className={cx(
                'h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
                !on && 'border-line-2 bg-surface text-ink-2 hover:border-ink-3',
                on && (o.tone === 'stop' ? 'border-stop bg-stop text-white' : o.tone === 'wait' ? 'border-wait bg-wait text-white' : o.tone === 'go' ? 'border-go bg-go text-white' : 'border-ink bg-ink text-white'),
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3">
      <span>
        <span className="block text-[15px] font-semibold">{label}</span>
        {hint && <span className="block text-sm text-ink-3">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-line-2 transition-colors peer-checked:bg-go peer-focus-visible:outline-3 peer-focus-visible:outline-brass" />
        <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

// Bottom sheet on phones, centred dialog on larger screens. Uses the native <dialog> for focus trapping and Esc.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-ink/40 open:animate-[sheet-up_.22s_ease-out] sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id="sheet-title" className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-ink/5" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-3" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden /> <span>{label}…</span>
    </div>
  )
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-2 px-6 py-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-brass-soft text-brass-deep">{icon}</div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">{body}</p>
      </div>
      {action}
    </div>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'stop' | 'wait' | 'go' | 'brass'; children: ReactNode }) {
  const t = {
    neutral: 'bg-ink/5 text-ink-2',
    stop: 'bg-stop-soft text-stop',
    wait: 'bg-wait-soft text-wait',
    go: 'bg-go-soft text-go',
    brass: 'bg-brass-soft text-brass-deep',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', t)}>{children}</span>
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl bg-stop-soft px-3 py-2.5 text-sm font-medium text-stop">{children}</p>
}

// ---- Toasts ----
type Toast = { id: number; text: string; tone: 'go' | 'stop' | 'neutral' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: Toast['tone'] = 'neutral') => {
    const id = Date.now() + Math.random()
    setToasts([{ id, text, tone }]) // newest replaces older, so messages never pile up over the page
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto animate-[toast-in_.2s_ease-out] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg',
            t.tone === 'go' ? 'bg-go text-white' : t.tone === 'stop' ? 'bg-stop text-white' : 'bg-ink text-white')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
