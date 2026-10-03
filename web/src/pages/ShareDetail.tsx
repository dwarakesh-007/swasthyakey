import { ArrowLeft, Copy, Eye, Send, ShieldOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { KeyTag } from '../components/KeyTag'
import { Badge, Button, Card, ErrorNote, Spinner, useToast } from '../components/ui'
import { useUserId } from '../lib/auth'
import { formatWhen, sectionInfo, SECTION_ORDER, shareUrl } from '../lib/format'
import { pingShare, useLiveUpdates, useNow } from '../lib/hooks'
import { friendlyError, supabase } from '../lib/supabase'
import type { AccessLog, Share } from '../lib/types'

export function shareState(s: Share, now: number): 'active' | 'revoked' | 'expired' {
  if (s.revoked_at) return 'revoked'
  if (s.expires_at && new Date(s.expires_at).getTime() <= now) return 'expired'
  return 'active'
}

export function ShareDetail() {
  const { id } = useParams()
  const userId = useUserId()
  const toast = useToast()
  const navigate = useNavigate()
  const now = useNow()
  const [share, setShare] = useState<Share | null>(null)
  const [views, setViews] = useState<AccessLog[]>([])
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seen = useRef<number | null>(null)

  const load = useCallback(async () => {
    const [s, v] = await Promise.all([
      supabase.from('shares').select('*').eq('id', id).maybeSingle<Share>(),
      supabase.from('access_logs').select('*').eq('share_id', id).order('viewed_at', { ascending: false }),
    ])
    if (!s.data) return setMissing(true)
    setShare(s.data)
    const list = (v.data ?? []) as AccessLog[]
    if (seen.current !== null && list.length > seen.current) toast(`Opened just now on ${list[0].device ?? 'a device'}`, 'go')
    seen.current = list.length
    setViews(list)
  }, [id, toast])

  useEffect(() => { load() }, [load])
  useLiveUpdates(userId, load, 5000)

  if (missing) return <ErrorNote>This share does not exist. <Link to="/shares" className="underline">See your shares</Link></ErrorNote>
  if (!share) return <Spinner />

  const state = shareState(share, now)
  const created = new Date(share.created_at).getTime()
  const expires = share.expires_at ? new Date(share.expires_at).getTime() : null
  const msLeft = expires ? Math.max(0, expires - now) : null
  const remaining = expires ? msLeft! / (expires - created) : null
  const url = shareUrl(share.token)

  const revoke = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('revoke_share', { p_share_id: share.id })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setShare(data as Share)
    toast('Access revoked. Their screen is locked.', 'go')
    pingShare(share.token)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      setError('Could not copy. Long-press the QR code area instead.')
    }
  }
  const send = async () => {
    try {
      await navigator.share({ title: 'My health record', text: 'Open my shared health record (time-limited):', url })
    } catch { /* cancelled */ }
  }

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate('/shares')} className="mb-4 inline-flex h-10 items-center gap-2 rounded-xl pr-3 font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-5" aria-hidden />All shares
      </button>

      <KeyTag url={url} state={state} remaining={remaining} msLeft={msLeft}
        title={share.kind === 'emergency' ? 'Emergency card' : share.label ?? 'Show this to your doctor'}
        subtitle={state === 'active' ? 'Ask them to scan it with their phone camera' : null} />

      <div className="mt-6 flex flex-col gap-3">
        {state === 'active' ? (
          <>
            <Button variant="danger" size="lg" onClick={revoke} loading={busy} className="w-full"><ShieldOff className="size-5" aria-hidden />Revoke access now</Button>
            <div className="flex gap-2 *:flex-1">
              <Button variant="secondary" onClick={copy}><Copy className="size-4" aria-hidden />Copy link</Button>
              {'share' in navigator && <Button variant="secondary" onClick={send}><Send className="size-4" aria-hidden />Send link</Button>}
            </div>
          </>
        ) : (
          <Button size="lg" variant="brass" onClick={() => navigate('/share/new')} className="w-full">Create a new share</Button>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-bold">They can see</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li><Badge>Name, age, sex, blood group</Badge></li>
          {SECTION_ORDER.filter((k) => share.sections.includes(k)).map((k) => <li key={k}><Badge tone="go">{sectionInfo[k].title}</Badge></li>)}
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="flex items-center gap-2 font-bold"><Eye className="size-5 text-brass-deep" aria-hidden />Opened {views.length} {views.length === 1 ? 'time' : 'times'}</h2>
        {views.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Nobody has opened it yet. You'll see each view here as it happens.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {views.map((v) => (
              <li key={v.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold">{v.device ?? 'Unknown device'}</span>
                <span className="text-ink-3">{formatWhen(v.viewed_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
