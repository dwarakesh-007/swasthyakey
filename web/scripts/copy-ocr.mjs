// Copies the OCR engine and English language data into public/ocr so the site hosts them itself.
// No third-party CDN is contacted when a patient scans a prescription.
import { cpSync, mkdirSync, readdirSync } from 'node:fs'

const out = 'public/ocr'
mkdirSync(`${out}/core`, { recursive: true })
mkdirSync(`${out}/lang`, { recursive: true })
cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
for (const f of readdirSync('node_modules/tesseract.js-core'))
  if (/-lstm\.wasm\.js$/.test(f)) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/core/${f}`)
cpSync('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${out}/lang/eng.traineddata.gz`)
console.log('OCR files copied to', out)
