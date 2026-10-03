// Unit tests for the prescription reader. Run: npx tsx tests/prescription.test.ts
import { parsePrescription } from '../web/src/lib/prescription'

let failed = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want)
  if (!pass) failed++
  console.log(pass ? '  ✓' : '  ✗', name, pass ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`)
}

const rx = parsePrescription(`Dr. K. Srinivas MBBS, MD
Reg No 45213   Ph: 9849012345
Name: Lakshmi Devi   Age: 64 F   Date: 02/10/2026
Diagnosis: Type 2 DM, HTN
Rx
1. Tab. Metformin 500 mg 1-0-1 after food x 30 days
2. Tab Amlodipine 5mg OD
3) Cap. Omez 20 mg 1-0-0 before food for 2 weeks
4. Syp. Benadryl 10 ml TDS
5. Tab Dolo 650 SOS
Inj. Insulin Glargine 10 units HS
Tab Telma 40 BD
Advice: Walk 30 minutes daily
Review after 1 month`)

eq('finds exactly the 7 medicines', rx.map((r) => r.name), ['Metformin', 'Amlodipine', 'Omez', 'Benadryl', 'Dolo 650', 'Insulin Glargine', 'Telma 40'])
eq('reads doses', rx.map((r) => r.dose), ['500 mg', '5 mg', '20 mg', '10 ml', null, '10 units', null])
eq('understands dosing shorthand', rx.map((r) => r.frequency), ['1-0-1 (morning, night)', 'Once a day', '1-0-0 (morning)', 'Three times a day', 'Only when needed', 'At bedtime', 'Twice a day'])
eq('keeps food and duration instructions', rx[0].notes, 'After food. For 30 days')
eq('weeks become a duration', rx[2].notes, 'Before food. For 2 weeks')
eq('ignores doctor details, phone, diagnosis and advice', rx.some((r) => /Srinivas|Lakshmi|Walk|Review|Diagnosis/i.test(r.name)), false)
eq('four-slot pattern with bedtime', parsePrescription('Tab Clonazepam 0.5 mg 0-0-0-1')[0].frequency, '0-0-0-1 (bedtime)')
eq('every N hours', parsePrescription('Tab Paracetamol 500 mg q6h')[0].frequency, 'Every 6 hours')
eq('empty text gives nothing', parsePrescription(''), [])

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
