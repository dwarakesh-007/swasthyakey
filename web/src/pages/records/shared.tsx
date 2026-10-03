import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function ItemRow({ title, sub, meta, aside, onClick, muted }: { title: string; sub?: string; meta?: string; aside?: ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-2 active:bg-paper">
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${muted ? 'text-ink-3' : ''}`}>{title}</span>
          {sub && <span className="mt-0.5 block truncate text-sm text-ink-2">{sub}</span>}
          {meta && <span className="mt-0.5 block text-sm text-ink-3">{meta}</span>}
        </span>
        {aside}
        <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      </button>
    </li>
  )
}
