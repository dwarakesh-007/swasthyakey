// End-to-end checks of the database rules, run against a Supabase project.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... DB_URL=postgres://... node tests/backend.test.mjs
// DB_URL is only used to fast-forward one share's expiry time for the expiry test.
import { createClient } from '../web/node_modules/@supabase/supabase-js/dist/index.mjs'
import { execSync } from 'node:child_process'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_ANON_KEY
let failed = 0, passed = 0
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name) } else { failed++; console.log('  ✗', name) } }
const client = (headers) => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers } })

async function patient(tag) {
  const c = client()
  const email = `${tag}.${Date.now()}@test.swasthyakey.in`
  const { data, error } = await c.auth.signUp({ email, password: 'Str0ng-pass!', options: { data: { full_name: `Patient ${tag}` } } })
  if (error) throw error
  return { c, id: data.user.id }
}

console.log('\nAccounts & profile')
const A = await patient('asha')
const B = await patient('bala')
const { data: profA } = await A.c.from('profiles').select('*').single()
ok(profA?.full_name === 'Patient asha', 'profile auto-created with name')
const up = await A.c.from('profiles').update({ blood_group: 'B+', date_of_birth: '1961-05-04', sex: 'female',
  emergency_contact_name: 'Ravi', emergency_contact_phone: '+91 98480 00000', emergency_contact_relation: 'Son' }).eq('id', A.id)
ok(!up.error, 'patient can update own profile')
const badBG = await A.c.from('profiles').update({ blood_group: 'Z+' }).eq('id', A.id)
ok(!!badBG.error, 'invalid blood group rejected')

console.log('\nHealth locker')
await A.c.from('allergies').insert([{ substance: 'Penicillin', reaction: 'Hives, breathing difficulty', severity: 'severe' }, { substance: 'Dust', severity: 'mild' }], { defaultToNull: false })
await A.c.from('medications').insert([{ name: 'Metformin 500mg', dose: '1 tab', frequency: 'Twice daily', critical: true },
  { name: 'Vitamin D3', frequency: 'Weekly' }, { name: 'Old antibiotic', active: false }], { defaultToNull: false })
await A.c.from('conditions').insert([{ name: 'Type 2 Diabetes', status: 'managed' }, { name: 'Dengue', status: 'resolved', notes: 'private note' }], { defaultToNull: false })
const { data: aMeds } = await A.c.from('medications').select('*')
ok(aMeds.length === 3, 'patient reads own medications')
const { data: bSeesA } = await B.c.from('medications').select('*')
ok(bSeesA.length === 0, 'another patient sees none of them')
const forge = await B.c.from('allergies').insert({ substance: 'x', user_id: A.id })
ok(!!forge.error, 'cannot write into another patient\'s record')
const anonRead = await client().from('allergies').select('*')
ok(anonRead.error || anonRead.data.length === 0, 'anonymous visitor cannot read records')

console.log('\nReport files')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const path = `${A.id}/cbc-report.png`
const upl = await A.c.storage.from('reports').upload(path, png, { contentType: 'image/png' })
ok(!upl.error, 'patient uploads file into own folder')
const wrongFolder = await B.c.storage.from('reports').upload(`${A.id}/evil.png`, png, { contentType: 'image/png' })
ok(!!wrongFolder.error, 'cannot upload into another patient\'s folder')
await A.c.from('reports').insert({ title: 'CBC blood test', kind: 'lab', report_date: '2026-09-01', file_path: path, file_name: 'cbc.png', mime_type: 'image/png' })
const bDl = await B.c.storage.from('reports').download(path)
ok(!!bDl.error, 'another patient cannot download the file')
const badReport = await B.c.from('reports').insert({ title: 'x', file_path: path })
ok(!!badReport.error, 'cannot attach someone else\'s file to a report')

console.log('\nSharing')
const direct = await A.c.from('shares').insert({ user_id: A.id, token: 'guessable', sections: ['allergies'], expires_at: new Date(Date.now() + 1e9).toISOString() })
ok(!!direct.error, 'shares cannot be inserted directly (token always server-made)')
const tooLong = await A.c.rpc('create_share', { p_sections: ['allergies'], p_minutes: 99999 })
ok(!!tooLong.error, 'share longer than 7 days rejected')
const badSection = await A.c.rpc('create_share', { p_sections: ['passwords'], p_minutes: 30 })
ok(!!badSection.error, 'unknown section rejected')
const { data: s1, error: e1 } = await A.c.rpc('create_share', { p_sections: ['allergies', 'medications'], p_minutes: 30, p_label: 'Dr. Rao' })
ok(!e1 && s1.token.length >= 30, 'share created with long random token')

const doctor = client()
const { data: v1 } = await doctor.rpc('open_share', { p_token: s1.token, p_device: 'test-runner' })
ok(v1.status === 'active' && v1.patient.full_name === 'Patient asha', 'doctor opens share without login')
ok(v1.patient.blood_group === 'B+' && v1.patient.age >= 60, 'basic details shown (blood group, age)')
ok(v1.allergies?.[0]?.substance === 'Penicillin', 'severe allergy listed first')
ok(v1.medications.length === 2 && !v1.medications.some(m => m.name === 'Old antibiotic'), 'only current medications shown')
ok(v1.conditions === undefined && v1.reports === undefined && v1.emergency_contact === undefined, 'sections not chosen are NOT sent')
const { data: logA } = await A.c.from('access_logs').select('*')
ok(logA.length === 1 && logA[0].device === 'test-runner', 'view recorded in patient\'s access log')
const { data: logB } = await B.c.from('access_logs').select('*')
ok(logB.length === 0, 'other patients cannot see that log')
const forgedLog = await A.c.from('access_logs').delete().gt('id', 0)
const { data: logA2 } = await A.c.from('access_logs').select('*')
ok(logA2.length === 1, 'access log cannot be deleted from the app')

const noFiles = client({ 'x-share-token': s1.token })
const nf = await noFiles.storage.from('reports').download(path)
ok(!!nf.error, 'share without "reports" cannot open files')

const { data: s2 } = await A.c.rpc('create_share', { p_sections: ['reports', 'conditions', 'emergency_contact'], p_minutes: 10 })
const doc2 = client({ 'x-share-token': s2.token })
const { data: v2 } = await doc2.rpc('open_share', { p_token: s2.token })
ok(v2.reports?.length === 1 && v2.emergency_contact?.name === 'Ravi', 'reports + emergency contact sent when chosen')
const dl = await doc2.storage.from('reports').download(v2.reports[0].file_path)
ok(!dl.error && dl.data.size === png.length, 'doctor downloads shared report file')
const wrongTok = client({ 'x-share-token': 'not-a-real-token' })
const wt = await wrongTok.storage.from('reports').download(path)
ok(!!wt.error, 'fake token cannot download')

console.log('\nRevoke & expiry')
const bRevoke = await B.c.rpc('revoke_share', { p_share_id: s2.id })
ok(!!bRevoke.error, 'another patient cannot revoke my share')
const rv = await A.c.rpc('revoke_share', { p_share_id: s2.id })
ok(!rv.error && rv.data.revoked_at, 'patient revokes share')
const { data: st } = await doc2.rpc('share_status', { p_token: s2.token })
ok(st.status === 'revoked', 'status check reports revoked')
const { data: v3 } = await doc2.rpc('open_share', { p_token: s2.token })
ok(v3.status === 'revoked' && !v3.patient, 'revoked share returns no data')
const dl2 = await doc2.storage.from('reports').download(path)
ok(!!dl2.error, 'file access stops the moment share is revoked')

if (process.env.DB_URL) {
  execSync(`psql "${process.env.DB_URL}" -qc "update public.shares set expires_at = now() - interval '1 second' where id = '${s1.id}'"`)
  const { data: v4 } = await doctor.rpc('open_share', { p_token: s1.token })
  ok(v4.status === 'expired' && !v4.patient, 'expired share returns no data')
}
const { data: nf2 } = await doctor.rpc('share_status', { p_token: 'nope' })
ok(nf2.status === 'not_found', 'unknown token → not found')

console.log('\nEmergency card')
const { data: em1 } = await A.c.rpc('create_emergency_card')
const { data: ev } = await client().rpc('open_share', { p_token: em1.token })
ok(ev.kind === 'emergency' && ev.expires_at === null, 'emergency card never expires')
ok(ev.medications.length === 1 && ev.medications[0].critical, 'emergency card shows only critical medicines')
ok(ev.conditions.every(c => c.status !== 'resolved' && c.notes === null), 'emergency card hides resolved conditions and notes')
ok(ev.patient.abha_number === null, 'emergency card hides ABHA number')
const { data: em2 } = await A.c.rpc('create_emergency_card')
const { data: oldEm } = await client().rpc('share_status', { p_token: em1.token })
ok(oldEm.status === 'revoked' && em2.token !== em1.token, 'new emergency card replaces the old one')

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
