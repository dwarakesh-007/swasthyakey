import { Printer, RefreshCw, ShieldOff, Siren } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../components/Layout'
import { Button, Card, ErrorNote, Spinner, useToast } from '../components/ui'
import { useUserId } from '../lib/auth'
import { shareUrl } from '../lib/format'
import { pingShare, useLiveUpdates, useProfile, useShares } from '../lib/hooks'
import { friendlyError, supabase } from '../lib/supabase'

export function Emergency() {
  const userId = useUserId()
  const toast = useToast()
  const shares = useShares()
  const profile = useProfile()
  useLiveUpdates(userId, shares.reload)
  const [busy, setBusy] = useState<'create' | 'off' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (shares.loading || profile.loading) return <Spinner />
  const card = shares.data.find((s) => s.kind === 'emergency' && !s.revoked_at)
  const p = profile.data

  const create = async () => {
    if (card && !window.confirm('Make a new card? The old QR code stops working, so print or save the new one.')) return
    setBusy('create')
    setError(null)
    const { error } = await supabase.rpc('create_emergency_card')
    setBusy(null)
    if (error) return setError(friendlyError(error))
    if (card) pingShare(card.token)
    toast(card ? 'New card made. The old one no longer works.' : 'Emergency card ready', 'go')
    shares.reload()
  }
  const turnOff = async () => {
    if (!card || !window.confirm('Turn off your emergency card? Anyone scanning it will see nothing.')) return
    setBusy('off')
    const { error } = await supabase.rpc('revoke_share', { p_share_id: card.id })
    setBusy(null)
    if (error) return setError(friendlyError(error))
    pingShare(card.token)
    toast('Emergency card turned off')
    shares.reload()
  }

  const missing = [!p?.blood_group && 'blood group', !p?.emergency_contact_phone && 'emergency contact'].filter(Boolean)

  return (
    <>
      <PageTitle title="Emergency card" body="If you're ever unable to speak, anyone can scan this card to see what could save your life: allergies, essential medicines, ongoing conditions and who to call." />

      {missing.length > 0 && (
        <p className="mb-5 rounded-xl bg-wait-soft px-4 py-3 text-sm font-medium text-wait">
          Your {missing.join(' and ')} {missing.length > 1 ? 'are' : 'is'} missing. <Link to="/profile" className="underline">Add {missing.length > 1 ? 'them' : 'it'}</Link> so the card is useful.
        </p>
      )}

      {card ? (
        <>
          {/* wallet-sized card; prints on its own */}
          <div id="ecard" className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[20px] border-2 border-stop bg-surface print:shadow-none">
            <div className="flex items-center gap-2 bg-stop px-4 py-2.5 text-white">
              <Siren className="size-5" aria-hidden />
              <span className="font-bold">Medical emergency</span>
            </div>
            <div className="flex gap-4 p-4">
              <QRCodeSVG value={shareUrl(card.token)} level="Q" marginSize={0} className="size-32 shrink-0" fgColor="#14213d" title="Scan for emergency medical information" />
              <div className="min-w-0">
                <p className="text-lg leading-tight font-bold">{p?.full_name || 'Your name'}</p>
                {p?.blood_group && <p className="mt-2 text-sm text-ink-2">Blood group</p>}
                {p?.blood_group && <p className="text-3xl leading-none font-bold text-stop">{p.blood_group}</p>}
                <p className="mt-3 text-xs text-ink-2">Scan with any phone camera to see allergies, medicines and family contact.</p>
              </div>
            </div>
            {p?.emergency_contact_phone && (
              <p className="border-t border-line px-4 py-2.5 text-sm">
                Call <span className="font-semibold">{p.emergency_contact_name ?? 'family'}</span>{p.emergency_contact_relation ? ` (${p.emergency_contact_relation})` : ''}: <span className="tabular font-semibold">{p.emergency_contact_phone}</span>
              </p>
            )}
          </div>

          <div className="no-print mx-auto mt-6 flex max-w-[420px] flex-col gap-2">
            <Button size="lg" onClick={() => window.print()}><Printer className="size-5" aria-hidden />Print card</Button>
            <p className="text-center text-sm text-ink-3">Keep it in your wallet, or save a screenshot as your phone's lock screen.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={create} loading={busy === 'create'}><RefreshCw className="size-4" aria-hidden />Make new code</Button>
              <Button variant="ghost" onClick={turnOff} loading={busy === 'off'} className="text-stop"><ShieldOff className="size-4" aria-hidden />Turn off</Button>
            </div>
            <Link to={`/shares/${card.id}`} className="text-center text-sm font-semibold text-ink-2 underline underline-offset-2">See who scanned it ({card.view_count})</Link>
          </div>
        </>
      ) : (
        <Card className="no-print flex flex-col gap-4 p-5">
          <h2 className="text-lg font-bold">What the card shows</h2>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">
            <li>Your name, age, sex and blood group</li>
            <li>All allergies</li>
            <li>Only medicines you mark as essential</li>
            <li>Ongoing conditions (no private notes)</li>
            <li>Your emergency contact's phone number</li>
          </ul>
          <p className="text-sm text-ink-3">It never shows reports or past illnesses. It works until you turn it off, and every scan is logged.</p>
          <Button size="lg" variant="danger" onClick={create} loading={busy === 'create'}><Siren className="size-5" aria-hidden />Create my emergency card</Button>
        </Card>
      )}
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
      <style>{`@media print { body * { visibility: hidden; } #ecard, #ecard * { visibility: visible; } #ecard { position: absolute; left: 0; top: 0; width: 86mm; } }`}</style>
    </>
  )
}
