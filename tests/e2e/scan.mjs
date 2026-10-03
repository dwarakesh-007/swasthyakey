// Prescription scanning: renders a realistic printed prescription to a photo, then reads it in the app.
import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'

const APP = process.env.APP_URL ?? 'http://localhost:5173'
const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
const results = []
const ok = (c, n) => { results.push(c); console.log(c ? '  ✓' : '  ✗', n) }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const cspErrors = []
const _newContext = browser.newContext.bind(browser)
browser.newContext = async (o) => { const c = await _newContext(o); c.on('page', (pg) => pg.on('console', (m) => /Content Security Policy|Refused to/.test(m.text()) && cspErrors.push(m.text().slice(0, 160)))); return c }

// 1. make the "photo"
const paper = await (await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1.5 })).newPage()
await paper.setContent(`
<body style="margin:0;background:#e9e4da;display:grid;place-items:center;height:100vh">
<div style="width:760px;background:#fffdf8;padding:40px 48px;font-family:Georgia,serif;color:#1a1a2e;transform:rotate(-1.2deg);box-shadow:0 8px 30px #0003">
  <div style="border-bottom:2px solid #1a1a2e;padding-bottom:10px">
    <div style="font-size:26px;font-weight:bold">Dr. K. Srinivas Rao</div>
    <div style="font-size:15px">MBBS, MD (General Medicine). Reg No. 45213</div>
    <div style="font-size:15px">Sri Sai Clinic, Kukatpally, Hyderabad. Ph: 9849012345</div>
  </div>
  <div style="font-size:17px;margin:14px 0">Name: Lakshmi Devi &nbsp;&nbsp; Age: 64 F &nbsp;&nbsp; Date: 02/10/2026</div>
  <div style="font-size:17px">Diagnosis: Type 2 DM, HTN</div>
  <div style="font-size:34px;font-weight:bold;margin:12px 0 6px">Rx</div>
  <div style="font-size:21px;line-height:2">
    1. Tab. Metformin 500 mg &nbsp; 1-0-1 &nbsp; after food x 30 days<br>
    2. Tab. Amlodipine 5 mg &nbsp; OD<br>
    3. Cap. Omez 20 mg &nbsp; 1-0-0 &nbsp; before food for 2 weeks<br>
    4. Syp. Benadryl 10 ml &nbsp; TDS<br>
    5. Tab. Dolo 650 &nbsp; SOS
  </div>
  <div style="font-size:17px;margin-top:18px">Advice: Walk 30 minutes daily. Review after 1 month.</div>
</div></body>`)
const photo = `${SHOTS}../prescription-photo.jpg`
await paper.screenshot({ path: photo, type: 'jpeg', quality: 80 })

// 2. scan it in the app
const ctx = await browser.newContext({ ...devices['Pixel 7'] })
const P = await ctx.newPage()
const ocrRequests = []
P.on('request', (r) => { if (/ocr|tesseract|traineddata|wasm/.test(r.url())) ocrRequests.push(new URL(r.url()).host) })
await P.goto(`${APP}/signup`)
await P.getByLabel('Full name').fill('Scan Tester')
await P.getByLabel('Email').fill(`scan.${Date.now()}@example.com`)
await P.getByLabel('Password').fill('Scanner@2026')
await P.getByRole('button', { name: 'Create account' }).click()
await P.getByRole('heading', { name: /Welcome/ }).waitFor()
await P.goto(`${APP}/records/medicines`)
await P.getByRole('button', { name: 'Scan prescription' }).click()
await P.getByRole('dialog').locator('input[type=file]').setInputFiles(photo)
const t0 = Date.now()
await P.getByText(/^Found \d+ medicine/).waitFor({ timeout: 120000 })
console.log(`  read in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
await P.screenshot({ path: `${SHOTS}30-scan-review.png`, fullPage: true })
const names = await P.getByLabel('Medicine name').evaluateAll((els) => els.map((e) => e.value))
console.log('  found:', names.join(' | '))
ok(names.length === 5, 'all 5 medicines found, nothing else')
for (const n of ['Metformin', 'Amlodipine', 'Omez', 'Benadryl', 'Dolo'])
  ok(names.some((x) => x.toLowerCase().includes(n.toLowerCase())), `found ${n}`)
const freqs = await P.getByLabel('How often').evaluateAll((els) => els.map((e) => e.value))
ok(freqs.some((f) => f === '1-0-1 (morning, night)'), '1-0-1 understood as morning and night')
ok(freqs.some((f) => /Only when needed/.test(f)), 'SOS understood as only when needed')
ok(ocrRequests.every((h) => h.startsWith('localhost')), `OCR files served by our own site (${[...new Set(ocrRequests)].join(', ')})`)

await P.getByRole('button', { name: /Add 5 medicines/ }).click()
await P.getByText('Metformin').first().waitFor()
await P.screenshot({ path: `${SHOTS}31-scan-saved.png`, fullPage: true })
await P.getByRole('link', { name: 'Reports' }).click()
await P.getByText('Prescription').first().waitFor()
ok(true, 'medicines saved and photo stored in Reports')

ok(cspErrors.length === 0, `no security-policy blocks${cspErrors.length ? ': ' + cspErrors.join(' | ') : ''}`)
await browser.close()
const failed = results.filter((c) => !c).length
console.log(`\n${results.length - failed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
