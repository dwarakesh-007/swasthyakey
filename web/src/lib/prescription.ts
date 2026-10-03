// Turns OCR text from a prescription photo into medicine entries the patient can review.
// Handles common Indian prescription shorthand: Tab/Cap/Syp prefixes, 1-0-1 dosing, OD/BD/TDS/SOS, "x 5 days".

export type ParsedMedicine = {
  name: string
  dose: string | null
  frequency: string | null
  notes: string | null
  source: string // the original line, so the patient can compare
}

const FORM = String.raw`(?:tab(?:let)?s?|cap(?:sule)?s?|syp|syr(?:up)?|susp(?:ension)?|inj(?:ection)?|oint(?:ment)?|cream|gel|drops?|lotion|inhaler|sachet|powder)`
const FORM_RE = new RegExp(String.raw`^${FORM}\b\.?\s*`, 'i')
const DOSE_RE = /(\d+(?:\.\d+)?)\s?(mg|mcg|µg|g|gm|ml|iu|%|units?)\b/i
const PATTERN_RE = /\b([0-2½])\s*[-–—]\s*([0-2½])\s*[-–—]\s*([0-2½])(?:\s*[-–—]\s*([0-2½]))?\b/
const DURATION_RE = /(?:x|×|for)\s*(\d+)\s*(day|days|d|week|weeks|wk|wks|month|months|mon)\b/i

const ABBREVIATIONS: [RegExp, string][] = [
  [/\b(?:q\.?i\.?d|qds)\b/i, 'Four times a day'],
  [/\b(?:t\.?d\.?s|t\.?i\.?d)\b/i, 'Three times a day'],
  [/\b(?:b\.?d|b\.?i\.?d)\b/i, 'Twice a day'],
  [/\b(?:o\.?d|q\.?d)\b/i, 'Once a day'],
  [/\b(?:h\.?s)\b/i, 'At bedtime'],
  [/\b(?:s\.?o\.?s|p\.?r\.?n)\b/i, 'Only when needed'],
  [/\bstat\b/i, 'Immediately, once'],
  [/\bq\s?(\d+)\s?h\b/i, 'Every $1 hours'],
  [/\b(?:once daily|once a day)\b/i, 'Once a day'],
  [/\b(?:twice daily|twice a day)\b/i, 'Twice a day'],
  [/\b(?:thrice daily|three times a day)\b/i, 'Three times a day'],
  [/\bweekly\b/i, 'Once a week'],
]

const NOTE_RE: [RegExp, string][] = [
  [/\b(?:a\.?c\.?|before (?:food|meals?))\b/i, 'Before food'],
  [/\b(?:p\.?c\.?|after (?:food|meals?))\b/i, 'After food'],
  [/\bempty stomach\b/i, 'On an empty stomach'],
  [/\bwith (?:food|meals?)\b/i, 'With food'],
]

// Lines that are clearly not medicines
const SKIP_RE = /^(?:name|patient|age|sex|gender|date|dr\.?|doctor|reg(?:d|istration)?|mobile|ph(?:one)?|tel|address|diagnosis|dx|c\/o|complaints?|advice|review|follow|signature|hospital|clinic|bp|pulse|temp|weight|wt|ht|spo2|investigations?)\b/i

function describePattern(m: RegExpMatchArray): string {
  const parts = [m[1], m[2], m[3]].map((x) => (x === '½' ? 0.5 : Number(x)))
  const [morning, afternoon, night] = parts
  const names: string[] = []
  if (morning) names.push('morning')
  if (afternoon) names.push('afternoon')
  if (night) names.push('night')
  if (m[4] && Number(m[4]) > 0) names.push('bedtime')
  const code = m[0].replace(/\s+/g, '').replace(/[–—]/g, '-')
  return names.length ? `${code} (${names.join(', ')})` : code
}

function cleanLine(raw: string): string {
  return raw
    .replace(/[|_~`"“”‘’]/g, ' ')
    .replace(/^\s*(?:\d{1,2}|[ivx]{1,4})\s*[.)\]:-]\s*/i, '') // "1." "2)" "iii."
    .replace(/^\s*(?:rx|℞)\s*[:.]?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function parsePrescription(text: string): ParsedMedicine[] {
  const results: ParsedMedicine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw)
    if (line.length < 3 || SKIP_RE.test(line)) continue
    if (/\d{10}/.test(line.replace(/\s/g, '')) && !DOSE_RE.test(line)) continue // phone numbers

    const hasForm = FORM_RE.test(line)
    const dose = line.match(DOSE_RE)
    const pattern = line.match(PATTERN_RE)
    const abbr = ABBREVIATIONS.find(([re]) => re.test(line))
    if (!hasForm && !(dose && (pattern || abbr))) continue

    // Medicine name: text after the form word, up to the first dose / dosing / duration marker
    let rest = line.replace(FORM_RE, '')
    const cutAt = [rest.search(PATTERN_RE), rest.search(DURATION_RE), ...ABBREVIATIONS.map(([re]) => rest.search(re)), ...NOTE_RE.map(([re]) => rest.search(re))]
      .filter((i) => i > 0)
    if (cutAt.length) rest = rest.slice(0, Math.min(...cutAt))
    let name = rest.replace(/[-–—,:;.]+\s*$/, '').trim()
    // keep strength in the name ("Dolo 650"), but move "650 mg" to the dose field
    if (dose && name.toLowerCase().endsWith(dose[0].toLowerCase())) name = name.slice(0, -dose[0].length).trim()
    name = name.replace(/\s+/g, ' ').slice(0, 120)
    if (name.length < 2 || !/[a-z]/i.test(name)) continue

    let frequency: string | null = null
    if (pattern) frequency = describePattern(pattern)
    else if (abbr) frequency = abbr[1].replace('$1', line.match(abbr[0])?.[1] ?? '')

    const noteParts: string[] = []
    for (const [re, label] of NOTE_RE) if (re.test(line)) noteParts.push(label)
    const dur = line.match(DURATION_RE)
    if (dur) {
      const n = Number(dur[1])
      const unit = /^w/i.test(dur[2]) ? 'week' : /^m/i.test(dur[2]) ? 'month' : 'day'
      noteParts.push(`For ${n} ${unit}${n > 1 ? 's' : ''}`)
    }

    results.push({
      name: titleCase(name),
      dose: dose ? `${dose[1]} ${normaliseUnit(dose[2])}` : null,
      frequency,
      notes: noteParts.length ? noteParts.join('. ') : null,
      source: raw.trim(),
    })
  }
  return results
}

function normaliseUnit(u: string): string {
  const l = u.toLowerCase()
  if (l === 'gm') return 'g'
  if (l === 'µg') return 'mcg'
  if (l.startsWith('unit')) return 'units'
  return l === 'iu' ? 'IU' : l
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Mg|Ml|Mcg|Sr|Xr|Er|Cr|Dsr|Od|Ds|Mr|Lp)\b/g, (w) => w.toUpperCase())
}
