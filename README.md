# SwasthyaKey

A patient-held, consent-driven health record. Patients keep their allergies, medicines, conditions and reports on their phone, and share them with a doctor through a **time-limited QR code** that unlocks only the sections they choose. The patient can **revoke access with one tap**, and the doctor's screen locks within a fraction of a second. Every view is logged.

**Live:** https://swasthyakey.vercel.app

Built by team **Shouryangas** (VJIT Hyderabad) for VJ Hackathon 2026, Healthcare PS 3.

## What it does

**For patients** (sign up with email and password)
- Health locker: allergies (with severity), medicines (current and stopped, "essential" flag), conditions, reports with photo/PDF upload
- **Scan a prescription**: photograph it and the app reads the medicines, doses and Indian dosing shorthand (1-0-1, OD, BD, TDS, SOS, HS, "x 5 days", before/after food). Runs entirely on the phone; the photo is not sent anywhere while reading
- **Share with a doctor**: pick sections (allergies, medicines, conditions, reports, emergency contact) and a duration (15 min to 7 days). A brass "key tag" shows the QR code; its ring drains as time runs out
- **Revoke** any share instantly; shares also lock by themselves when time is up
- **Activity log**: every view, with time and device. It cannot be edited or deleted
- **Emergency card**: a permanent QR for the wallet or lock screen showing blood group, allergies, essential medicines, ongoing conditions and a tap-to-call family contact
- ABHA number field, data export (download everything as a file)

**For doctors** (no app, no login)
- Scan the QR with any phone camera; a one-page summary opens in the browser
- Allergies first, in red; medicines, conditions, reports (open the photo/PDF), emergency contact
- Clearly says which sections the patient chose not to share
- Live countdown; locks the moment the patient revokes or time runs out, and drops the data from the page

## How it is secured

- **Row Level Security** on every table: a patient can only read and write their own rows
- **Share tokens** are 192-bit random values made by the database, never by the browser. Patients cannot insert or edit shares directly, only through `create_share`, `revoke_share` and `create_emergency_card`
- **The doctor's view** goes through one function, `open_share`, which checks the token is active and returns only the chosen sections. Revoked, expired and unknown tokens return nothing
- **Report files** are in a private bucket, one folder per patient. A doctor can download a file only while their share token is active and includes reports. File access stops at the same moment as the share
- **Access log** rows are written only by the database. The app cannot delete or change them
- **Emergency card** shows only essential medicines, hides private notes, resolved conditions, reports and the ABHA number
- Strict **Content Security Policy**, no third-party scripts or CDNs (the OCR engine is served from the site itself), `X-Frame-Options: DENY`, `noindex`

## Tech

React 19 + TypeScript + Vite + Tailwind CSS 4, Supabase (Postgres, Auth, Storage, Realtime), tesseract.js for on-device OCR, deployed on Vercel.

```
supabase/migrations/   database tables, security rules, sharing functions, storage rules
web/                   the website
tests/                 backend security tests, prescription reader tests, full browser journeys
```

## Set up (about 10 minutes)

### 1. Supabase
1. Create a free project at [supabase.com](https://supabase.com) (region: Mumbai, `ap-south-1`).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261003000000_init.sql`, and run it.
3. **Authentication → URL Configuration**: set **Site URL** to your website address (for example `https://swasthyakey.vercel.app`) and add `https://swasthyakey.vercel.app/**` to **Redirect URLs**. Add `http://localhost:5173/**` too for local work.
4. **Authentication → Sign In / Providers → Email**: for the hackathon demo, turn **Confirm email** off so people can sign up and start immediately. (Supabase's built-in email sender only allows a few emails per hour. For real use, keep confirmation on and connect your own SMTP.)
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Run locally
```bash
cd web
cp .env.example .env.local     # paste your Project URL and anon key
npm install
npm run dev                    # http://localhost:5173
```

### 3. Deploy on Vercel
1. Import the repository in Vercel and set **Root Directory** to `web`.
2. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` already handles page routing and security headers.

## Tests

```bash
# database rules: privacy between patients, sharing, revoke, expiry, file access, emergency card (39 checks)
SUPABASE_URL=... SUPABASE_ANON_KEY=... node tests/backend.test.mjs

# prescription reader
cd web && npx tsx ../tests/prescription.test.ts

# full journeys in two browsers (patient phone + doctor phone), incl. live revoke and OCR
cd tests && npm install && APP_URL=http://localhost:5173 node e2e/flow.mjs && node e2e/scan.mjs
```

Use a test Supabase project for these, not your live one; they create test accounts.

## Demo script (2 minutes)

1. "Every new doctor starts from zero." Show the patient's home screen.
2. Tap **Share with a doctor**, keep allergies and medicines, choose 15 minutes, **Create QR code**.
3. Doctor scans with a normal phone camera: the summary opens in seconds, allergies in red.
4. Patient's phone shows "Opened just now on Chrome on Android".
5. Patient taps **Revoke access now**. The doctor's screen locks. Pause here.
6. Show **Activity**, then the **Emergency card**. Close: "Patient-controlled, and any small clinic can use it with just a phone."

## Not included yet
- Real ABHA/ABDM data exchange (needs ABDM sandbox approval); the ABHA number is stored and shown
- Telugu and Hindi interface
- Handwritten prescriptions are read less reliably than printed ones; the patient always reviews before saving
