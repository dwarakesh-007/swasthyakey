import { QRCodeSVG } from 'qrcode.react'
import { Lock } from 'lucide-react'
import { formatClock, formatRemaining } from '../lib/format'
import { cx } from './ui'

type Props = {
  url: string
  title: string
  subtitle?: string | null
  // fraction of time left, 0..1; null for shares that never expire (emergency card)
  remaining: number | null
  msLeft: number | null
  state: 'active' | 'revoked' | 'expired'
}

// The share, drawn as a brass key tag. The ring where a key would hang is the countdown:
// it drains as time runs out, and the tag goes grey and locks when access ends.
export function KeyTag({ url, title, subtitle, remaining, msLeft, state }: Props) {
  const active = state === 'active'
  const R = 26
  const C = 2 * Math.PI * R
  const frac = remaining === null ? 1 : Math.max(0, Math.min(1, remaining))
  const urgent = active && msLeft !== null && msLeft < 60_000

  return (
    <figure
      className={cx(
        'relative mx-auto w-full max-w-[320px] rounded-[32px] px-6 pt-5 pb-6 text-white shadow-[0_18px_40px_-18px_rgba(20,33,61,.55)] transition-colors duration-500',
        active ? 'bg-brass' : 'bg-ink-3',
      )}
      aria-label={active ? `Share code for ${title}` : 'This share is no longer active'}
    >
      {/* key ring hole doubling as the countdown */}
      <svg viewBox="0 0 64 64" className="mx-auto block size-16" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={R} fill="none" stroke={urgent ? '#ffd7d2' : 'white'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 32 32)"
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
        <circle cx="32" cy="32" r="15" className="fill-paper" />
      </svg>

      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[236px] rounded-2xl bg-white p-3">
        <QRCodeSVG value={url} level="M" marginSize={0} className={cx('size-full transition-[filter,opacity] duration-500', !active && 'opacity-20 blur-[6px]')} fgColor="#14213d" title="QR code to open your shared record" />
        {!active && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid size-16 animate-[lock-in_.35s_ease-out] place-items-center rounded-full bg-ink text-white">
              <Lock className="size-7" aria-hidden />
            </span>
          </div>
        )}
      </div>

      <figcaption className="mt-5 text-center">
        <p className="text-lg leading-tight font-bold">{title}</p>
        {subtitle && <p className="mt-1 text-sm text-white">{subtitle}</p>}
        <p className={cx('tabular mt-3 text-3xl font-bold tracking-tight', urgent && 'text-[#ffd7d2]')} aria-live="off">
          {state === 'revoked' ? 'Access revoked' : state === 'expired' ? 'Access ended' : msLeft === null ? 'No time limit' : msLeft < 3_600_000 ? formatClock(msLeft) : formatRemaining(msLeft)}
        </p>
        {active && msLeft !== null && <p className="text-sm text-white">left before it locks by itself</p>}
      </figcaption>
    </figure>
  )
}
