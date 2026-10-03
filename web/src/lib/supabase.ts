import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// The patient app: signed-in session, saved in the browser.
export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'swasthyakey-auth' },
})

// The doctor's viewer: never signs in, carries the share token so storage rules can check it.
export function viewerClient(token: string): SupabaseClient {
  return createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'swasthyakey-viewer' },
    global: { headers: { 'x-share-token': token } },
  })
}

export const REPORTS_BUCKET = 'reports'

// Turn Supabase / Postgres errors into sentences a patient can act on.
export function friendlyError(err: unknown): string {
  const msg = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err)
  if (/Invalid login credentials/i.test(msg)) return 'Email or password is wrong. Check both and try again.'
  if (/User already registered/i.test(msg)) return 'An account with this email already exists. Log in instead.'
  if (/Password should be at least/i.test(msg)) return 'Password needs at least 8 characters.'
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email first. We sent you a link.'
  if (/rate limit/i.test(msg)) return 'Too many attempts. Wait a minute and try again.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'No internet connection. Check your network and try again.'
  if (/abha_number/i.test(msg)) return 'ABHA number should look like 12-3456-7890-1234.'
  if (/blood_group/i.test(msg)) return 'Pick a blood group from the list.'
  if (/date_of_birth/i.test(msg)) return 'Date of birth cannot be in the future.'
  if (/maximum allowed size|Payload too large|exceeded the maximum/i.test(msg)) return 'File is too large. Upload a file under 10 MB.'
  if (/mime type|invalid_mime_type/i.test(msg)) return 'Only photos (JPG, PNG, WEBP) and PDF files can be uploaded.'
  if (/duration must be/i.test(msg)) return 'Pick a duration between 5 minutes and 7 days.'
  return msg || 'Something went wrong. Try again.'
}
