import type { ConditionStatus, ReportKind, SectionKey, Severity, Sex } from './types'

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' })
const dayTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const formatDate = (d: string | null | undefined) => (d ? dateFmt.format(new Date(d)) : '')
export const formatTime = (d: string | Date) => timeFmt.format(new Date(d))

export function formatWhen(d: string): string {
  const date = new Date(d)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString() === date.toDateString()
  if (sameDay) return `Today, ${formatTime(date)}`
  if (yesterday) return `Yesterday, ${formatTime(date)}`
  return dayTimeFmt.format(date)
}

export function ageFrom(dob: string | null): number | null {
  if (!dob) return null
  const b = new Date(dob)
  const n = new Date()
  let age = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--
  return age
}

// "12 min", "1 h 05 min", "2 days"
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min'
  const totalMin = Math.ceil(ms / 60_000)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h < 24) return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh ? `${d} day${d > 1 ? 's' : ''} ${rh} h` : `${d} day${d > 1 ? 's' : ''}`
}

// "14:05" style clock for the last hour, used by the big countdown
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`
  if (minutes < 1440) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`
  return minutes === 1440 ? '1 day' : `${minutes / 1440} days`
}

export const sexLabel: Record<Sex, string> = { female: 'Female', male: 'Male', other: 'Other' }

export const severityLabel: Record<Severity, string> = { mild: 'Mild', moderate: 'Moderate', severe: 'Severe' }

export const conditionStatusLabel: Record<ConditionStatus, string> = {
  active: 'Ongoing',
  managed: 'Under control',
  resolved: 'Recovered',
}

export const reportKindLabel: Record<ReportKind, string> = {
  lab: 'Lab test',
  imaging: 'Scan / X-ray',
  prescription: 'Prescription',
  discharge: 'Discharge summary',
  other: 'Other document',
}

export const sectionInfo: Record<SectionKey, { title: string; hint: string }> = {
  allergies: { title: 'Allergies', hint: 'Medicines or foods that cause reactions' },
  medications: { title: 'Current medicines', hint: 'What you take now, with dose' },
  conditions: { title: 'Health conditions', hint: 'Diagnoses, past and ongoing' },
  reports: { title: 'Reports & documents', hint: 'Lab results, scans, prescriptions' },
  emergency_contact: { title: 'Emergency contact', hint: 'Who to call for you' },
}

export const SECTION_ORDER: SectionKey[] = ['allergies', 'medications', 'conditions', 'reports', 'emergency_contact']

// "Chrome on Android" from a user agent string, sent with each view so patients know which device opened it.
export function describeDevice(ua: string): string {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Unknown device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/v/${token}`
}

export function humanFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
