import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { AccessLog, Allergy, Condition, Medication, Profile, Report, Share } from './types'

// Re-renders every `intervalMs` so countdowns stay live.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

type Query<T> = { data: T; loading: boolean; error: string | null; reload: () => Promise<void> }

function useQuery<T>(fetcher: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, initial: T, deps: unknown[] = []): Query<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher

  const reload = useCallback(async () => {
    const res = await fetchRef.current()
    if (res.error) setError(res.error.message)
    else {
      setError(null)
      setData(res.data ?? initial)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    setLoading(true)
    reload()
  }, [reload])

  return { data, loading, error, reload }
}

export const useProfile = () =>
  useQuery<Profile | null>(() => supabase.from('profiles').select('*').maybeSingle<Profile>(), null)

export const useAllergies = () =>
  useQuery<Allergy[]>(() => supabase.from('allergies').select('*').order('created_at', { ascending: false }), [])

export const useMedications = () =>
  useQuery<Medication[]>(() => supabase.from('medications').select('*').order('active', { ascending: false }).order('created_at', { ascending: false }), [])

export const useConditions = () =>
  useQuery<Condition[]>(() => supabase.from('conditions').select('*').order('created_at', { ascending: false }), [])

export const useReports = () =>
  useQuery<Report[]>(() => supabase.from('reports').select('*').order('report_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }), [])

export const useShares = () =>
  useQuery<Share[]>(() => supabase.from('shares').select('*').order('created_at', { ascending: false }).limit(100), [])

export const useAccessLog = (limit = 200) =>
  useQuery<AccessLog[]>(() => supabase.from('access_logs').select('*').order('viewed_at', { ascending: false }).limit(limit), [], [limit])

// Calls `onChange` when the patient's shares or access log change.
// Uses Supabase Realtime, plus a slow poll as a safety net if the live connection drops.
export function useLiveUpdates(userId: string, onChange: () => void, pollMs = 15000) {
  const cb = useRef(onChange)
  cb.current = onChange
  useEffect(() => {
    const channel = supabase
      .channel(`patient-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs', filter: `user_id=eq.${userId}` }, () => cb.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shares', filter: `user_id=eq.${userId}` }, () => cb.current())
      .subscribe()
    const id = window.setInterval(() => document.visibilityState === 'visible' && cb.current(), pollMs)
    const onVis = () => document.visibilityState === 'visible' && cb.current()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      supabase.removeChannel(channel)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [userId, pollMs])
}

// Tell any open doctor page for this share to re-check right now (used after revoking).
export async function pingShare(token: string) {
  const channel = supabase.channel(`share-${token}`)
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 2500)
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({ type: 'broadcast', event: 'changed', payload: {} })
        window.clearTimeout(timer)
        resolve()
      }
    })
  })
  supabase.removeChannel(channel)
}
