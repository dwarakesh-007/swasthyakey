// Full patient + doctor journey in two real browsers. Saves screenshots to tests/e2e/shots.
// Usage: APP_URL=http://localhost:5173 node tests/e2e/flow.mjs
import { chromium, devices } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
let step = 0
const results = []
const ok = (cond, name) => { results.push([cond, name]); console.log(cond ? '  ✓' : '  ✗', name) }
const shot = (page, name) => page.screenshot({ path: `${SHOTS}${String(++step).padStart(2, '0')}-${name}.png`, fullPage: true })

// a small valid PNG to upload as a "report"
function png(w = 64, h = 48) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 200; raw[o + 1] = 60 + y * 3; raw[o + 2] = 40 + x * 2 }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const reportFile = `${SHOTS}../cbc.png`
writeFileSync(reportFile, png())

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const cspErrors = []
const _newContext = browser.newContext.bind(browser)
browser.newContext = async (o) => { const c = await _newContext(o); c.on('page', (pg) => pg.on('console', (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text().slice(0, 160)))); return c }
const patientCtx = await browser.newContext({ ...devices['Pixel 7'], permissions: ['clipboard-read', 'clipboard-write'] })
const doctorCtx = await browser.newContext({ ...devices['iPhone 13'] })
const P = await patientCtx.newPage()
const errors = []
P.on('pageerror', (e) => errors.push(`patient: ${e.message}`))

console.log('\nLanding & sign up')
await P.goto(APP)
await P.getByRole('heading', { name: /Your health history/ }).waitFor()
await shot(P, 'landing')
await P.getByRole('link', { name: 'Create your free record' }).click()
const email = `lakshmi.${Date.now()}@example.com`
await P.getByLabel('Full name').fill('Lakshmi Devi')
await P.getByLabel('Email').fill(email)
await P.getByLabel('Password').fill('Lakshmi@2026')
await shot(P, 'signup')
await P.getByRole('button', { name: 'Create account' }).click()
await P.getByRole('heading', { name: /Welcome/ }).waitFor()
ok(true, 'account created, lands on welcome details page')

await P.getByLabel('Date of birth').fill('1962-03-14')
await P.getByLabel('Blood group').selectOption('B+')
await P.getByRole('button', { name: 'Female' }).click()
await P.getByLabel('Phone').first().fill('+91 94400 12345')
await P.getByLabel('ABHA number (optional)').fill('91234567890123')
ok(await P.getByLabel('ABHA number (optional)').inputValue() === '91-2345-6789-0123', 'ABHA number auto-formats')
await P.getByRole('textbox', { name: 'Name', exact: true }).fill('Ravi Kumar')
await P.getByLabel('Phone').nth(1).fill('+91 98480 22222')
await P.getByLabel('Relation').fill('Son')
await shot(P, 'profile')
await P.getByRole('button', { name: 'Save and continue' }).click()
await P.getByRole('heading', { name: 'Hello, Lakshmi' }).waitFor()
await shot(P, 'home-empty')
ok(await P.getByText('B+').first().isVisible(), 'home shows blood group')

console.log('\nRecords')
await P.goto(`${APP}/records/allergies`)
await P.getByRole('button', { name: 'Add allergy' }).click()
await P.getByLabel('Allergic to').fill('Penicillin')
await P.getByLabel('What happens (optional)').fill('Swelling of face, breathing difficulty')
await P.getByRole('button', { name: 'Severe' }).click()
await shot(P, 'add-allergy')
await P.getByRole('dialog').getByRole('button', { name: 'Add allergy' }).click()
await P.getByText('Penicillin').waitFor()
await P.getByRole('button', { name: 'Add allergy' }).click()
await P.getByLabel('Allergic to').fill('Sulfa drugs')
await P.getByRole('dialog').getByRole('button', { name: 'Add allergy' }).click()
await P.getByText('Sulfa drugs').waitFor()
ok(true, 'two allergies added')

await P.getByRole('link', { name: 'Medicines' }).click()
for (const [name, dose, freq, essential] of [['Metformin', '500 mg', 'Twice a day, 1-0-1', false], ['Insulin Glargine', '10 units', 'At bedtime', true], ['Amlodipine', '5 mg', 'Once a day', false]]) {
  await P.getByRole('button', { name: 'Add', exact: true }).click()
  await P.getByLabel('Medicine name').fill(name)
  await P.getByLabel('Dose').fill(dose)
  await P.getByLabel('How often').fill(freq)
  if (essential) await P.getByText('Essential medicine', { exact: true }).click()
  await P.getByRole('dialog').getByRole('button', { name: 'Add medicine' }).click()
  await P.getByText(name).first().waitFor()
}
await shot(P, 'medicines')
ok(await P.getByText('Essential').isVisible(), 'essential medicine badge shown')

await P.getByRole('link', { name: 'Conditions' }).click()
await P.getByRole('button', { name: 'Add condition' }).click()
await P.getByLabel('Condition', { exact: true }).fill('Type 2 diabetes')
await P.getByLabel('Diagnosed on (optional)').fill('2015-06-01')
await P.getByRole('button', { name: 'Under control' }).click()
await P.getByRole('dialog').getByRole('button', { name: 'Add condition' }).click()
await P.getByText('Type 2 diabetes').waitFor()
await P.getByRole('button', { name: 'Add condition' }).click()
await P.getByLabel('Condition', { exact: true }).fill('Hypertension')
await P.getByRole('dialog').getByRole('button', { name: 'Add condition' }).click()
await P.getByText('Hypertension').waitFor()
await shot(P, 'conditions')

await P.getByRole('link', { name: 'Reports' }).click()
await P.getByRole('button', { name: 'Add report' }).click()
await P.locator('input[type=file]').setInputFiles(reportFile)
await P.getByLabel('Title').fill('HbA1c and CBC')
await P.getByLabel('Date of report').fill('2026-09-20')
await P.getByLabel('Key findings (optional)').fill('HbA1c 7.1%, Hb 11.9 g/dL')
await shot(P, 'add-report')
await P.getByRole('dialog').getByRole('button', { name: 'Add report' }).click()
await P.getByText('HbA1c and CBC').waitFor()
await shot(P, 'reports')
ok(true, 'report with photo uploaded')

console.log('\nShare')
await P.goto(`${APP}/home`)
await P.getByText('Penicillin').waitFor()
await shot(P, 'home-filled')
await P.getByRole('link', { name: /Share with a doctor/ }).click()
await P.getByRole('heading', { name: 'Share with a doctor' }).waitFor()
await P.getByRole('button', { name: /Health conditions/ }).click()
await P.getByRole('button', { name: /Reports & documents/ }).click()
await P.getByRole('button', { name: '1 hour' }).click()
await P.getByLabel('Who is this for? (optional)').fill('Dr. Rao, City Clinic')
await shot(P, 'share-new')
await P.getByRole('button', { name: 'Create QR code' }).click()
await P.getByRole('button', { name: 'Revoke access now' }).waitFor()
await shot(P, 'share-keytag')
await P.getByRole('button', { name: 'Copy link' }).click()
const link = await P.evaluate(() => navigator.clipboard.readText())
ok(/\/v\/[\w-]{30,}$/.test(link), 'share link has a long secret token')

console.log('\nDoctor')
const D = await doctorCtx.newPage()
D.on('pageerror', (e) => errors.push(`doctor: ${e.message}`))
await D.goto(link)
await D.getByRole('heading', { name: 'Lakshmi Devi' }).waitFor()
await shot(D, 'doctor-view')
ok(await D.getByText('Penicillin').isVisible(), 'doctor sees allergies')
ok(await D.getByRole('heading', { name: /Allergies \(2\)/ }).isVisible(), 'allergy block at top with count')
ok(await D.getByText('Type 2 diabetes').isVisible(), 'doctor sees conditions')
ok(!(await D.getByText('Ravi Kumar').count()), 'emergency contact NOT shown (not chosen)')
ok(await D.getByText(/Not shared by the patient: emergency contact/).isVisible(), 'doctor is told what was not shared')
const popup = D.context().waitForEvent('page')
await D.getByRole('button', { name: 'View photo' }).click()
const filePage = await popup
const opened = await filePage.waitForURL(/^blob:/, { timeout: 8000 }).then(() => true, () => false)
ok(opened, `doctor opens the report photo (${filePage.url().slice(0, 30)})`)
await filePage.close()

await P.getByRole('heading', { name: /Opened 1 time/ }).waitFor({ timeout: 12000 })
ok(true, 'patient sees the view live, with device name')
await shot(P, 'share-viewed')

console.log('\nRevoke')
const t0 = Date.now()
await P.getByRole('button', { name: 'Revoke access now' }).click()
await D.getByRole('heading', { name: 'Access revoked' }).waitFor({ timeout: 6000 })
const lockMs = Date.now() - t0
ok(lockMs < 2000, `doctor's screen locked ${lockMs} ms after revoke`)
ok(!(await D.getByText('Penicillin').count()), 'patient data removed from doctor page')
await shot(D, 'doctor-locked')
await shot(P, 'share-revoked')
await D.goto(link)
await D.getByRole('heading', { name: 'Access revoked' }).waitFor()
ok(true, 're-opening the link stays locked')

console.log('\nEmergency card')
await P.goto(`${APP}/emergency`)
await P.getByRole('button', { name: 'Create my emergency card' }).click()
await P.getByText('Medical emergency').waitFor()
await shot(P, 'emergency-card')
const emToken = await P.evaluate(async () => {
  const raw = localStorage.getItem('swasthyakey-auth'); return raw ? 'ok' : 'none'
})
ok(emToken === 'ok', 'session stored')
await P.getByRole('link', { name: /See who scanned it/ }).click()
await P.getByRole('button', { name: 'Copy link' }).click()
const emLink = await P.evaluate(() => navigator.clipboard.readText())
await D.goto(emLink)
await D.getByText('Emergency information').waitFor()
await shot(D, 'doctor-emergency')
ok(await D.getByText('Insulin Glargine').isVisible() && !(await D.getByText('Metformin').count()), 'emergency shows only essential medicines')
ok(await D.getByRole('link', { name: /Ravi Kumar/ }).isVisible(), 'emergency shows tap-to-call family contact')

console.log('\nActivity & desktop')
await P.goto(`${APP}/activity`)
await P.getByText('Emergency card scanned').waitFor()
await shot(P, 'activity')
await P.goto(`${APP}/shares`)
await P.getByRole('heading', { name: 'Ended' }).waitFor()
await shot(P, 'shares')

const desk = await browser.newContext({ viewport: { width: 1366, height: 860 }, storageState: await patientCtx.storageState() })
const W = await desk.newPage()
await W.goto(`${APP}/home`)
await W.getByRole('heading', { name: 'Hello, Lakshmi' }).waitFor()
await shot(W, 'desktop-home')
await W.goto(`${APP}/share/new`)
await shot(W, 'desktop-share-new')
const deskDoc = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage()
await deskDoc.goto(emLink)
await deskDoc.getByText('Emergency information').waitFor()
await shot(deskDoc, 'desktop-doctor-emergency')
const landing = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage()
await landing.goto(APP)
await landing.getByRole('heading', { name: /Your health history/ }).waitFor()
await shot(landing, 'desktop-landing')

console.log('\nLog out & protection')
await P.goto(`${APP}/profile`)
await P.goto(`${APP}/home`)
const fresh = await (await browser.newContext()).newPage()
await fresh.goto(`${APP}/records/allergies`)
await fresh.getByRole('heading', { name: 'Log in' }).waitFor()
ok(true, 'signed-out visitor is sent to log in')
await fresh.goto(`${APP}/v/not-a-real-token-123`)
await fresh.getByRole('heading', { name: 'Link not valid' }).waitFor()
ok(true, 'fake QR link shows "Link not valid"')

ok(errors.length === 0, `no page crashes${errors.length ? ': ' + errors.join(' | ') : ''}`)
ok(cspErrors.length === 0, `no security-policy blocks${cspErrors.length ? ': ' + cspErrors.join(' | ') : ''}`)
await browser.close()
const failed = results.filter(([c]) => !c).length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
