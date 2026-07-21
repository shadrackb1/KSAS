# KSAS — Kabarak Smart Attendance System

Attendance fraud is a real problem at universities. KSAS fixes it with QR codes that expire every five seconds, device fingerprinting, and a five-layer check that runs every time a student taps "Check In." Built for Kabarak University. React, TypeScript, Firebase.

---

## What It Does

**Students** scan a QR code to check in. The system checks their device, location, and network before recording attendance. They can track their own stats — per-course percentages, trends, how they compare to the class average. Registration numbers are parsed to auto-derive school affiliation, which helps surface relevant sessions and flag cross-school courses. Feedback is fully anonymous.

**Lecturers** start a session, display a live QR code, and watch check-ins roll in real time. The QR refreshes every 5 seconds with a new TOTP token, so screenshots are useless. They get analytics, risk alerts for students dropping below 75%, and one-click CSV exports.

**Admins** manage users, assign courses, configure school code mappings, browse archived sessions, and pull organisation-wide reports. Everything syncs through Firestore in real time.

---

## Security

Every check-in passes through five layers:

| # | What It Does | Why |
|---|---|---|
| 1 | Device fingerprint binding | One device = one student. No proxy check-ins. |
| 2 | One-time TOTP token | Each QR scan consumes the token. Screenshot sharing breaks. |
| 3 | GPS proximity check | Optional. Verifies the student is on campus. |
| 4 | IP range validation | Optional. Confirms the student is on the campus network. |
| 5 | Enrollment verification | Student must be enrolled in the course to check in. |
| 6 | Session device lock | One device can't check in for two different students. |

QR codes refresh every 5 seconds. Keyboard shortcuts like PrintScreen and Ctrl+Shift+S are intercepted. CSS blocks drag-and-drop. There's a watermark on the QR. Role-based access controls who sees what. Passwords are SHA-256 hashed.

---

## Tech

| Layer | What We Used |
|-------|-------------|
| Framework | React 19, TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| Routing | React Router DOM v7 |
| Charts | Recharts v3 |
| Icons | Lucide React |
| Animations | Motion |
| Notifications | react-hot-toast |
| QR | qrcode.react, @yudiel/react-qr-scanner |
| TOTP | otpauth (5-second window) |
| CSV | PapaParse |
| Dates | date-fns |
| Database | Firebase / Firestore (real-time listeners) |
| Archival | Cloudinary (JSON session records) |
| Auth | Custom localStorage, SHA-256 passwords |

---

## Structure

```
src/
├── App.tsx              Routes for every role
├── main.tsx             Entry point
├── index.css            Theme, utilities, animations
├── components/
│   ├── ErrorBoundary.tsx    Catches render errors
│   └── layout/
│       ├── AppLayout.tsx    Sidebar + topbar + mobile nav
│       ├── DesktopSidebar.tsx  Desktop nav
│       ├── MobileNav.tsx    Bottom tab bar
│       └── TopAppBar.tsx    Notifications, profile
├── hooks/
│   ├── useAuth.ts           localStorage auth
│   ├── useCloudinaryCache.ts Cloudinary caching
│   └── useFirestoreRealtime.ts Real-time Firestore hook
├── lib/
│   ├── analytics.ts         Stats and scoring
│   ├── auth.ts              Password hashing
│   ├── backfillSchoolCodes.ts  One-time migration for school codes
│   ├── cloudinary.ts        Upload/download
│   ├── collections.ts       Firestore collection names
│   ├── csvExport.ts         CSV generation
│   ├── db.ts                checkIn, archive, close, enrollment check
│   ├── firebase.ts          Firebase init
│   ├── gamification.ts      XP, levels, ranks, streaks
│   ├── regNumberParser.ts   Registration number → school code parser
│   ├── schoolCodes.ts       School code mapping CRUD (Firestore)
│   ├── security.ts          Anti-fraud validation
│   ├── totp.ts              TOTP generation
│   └── utils.ts             Helpers
└── pages/
    ├── RoleSelection.tsx    Login landing
    ├── admin/
    │   ├── Dashboard.tsx
    │   ├── CreateUser.tsx       Auto-derives schoolCode from reg number
    │   ├── SchoolCodes.tsx      School code mapping management
    │   ├── CourseManagement.tsx
    │   ├── SessionArchive.tsx
    │   ├── Analytics.tsx
    │   └── Reports.tsx
    ├── lecturer/
    │   ├── Dashboard.tsx
    │   ├── LiveSession.tsx      Live QR + manual attendance
    │   ├── CourseManagement.tsx
    │   └── RiskMonitor.tsx
    └── student/
        ├── Dashboard.tsx        All active/upcoming sessions, anonymous feedback
        ├── CheckIn.tsx          Pre-confirmation before check-in
        ├── Courses.tsx
        └── Analytics.tsx
```

---

## Setup

You need Node 18+, a Firebase project with Firestore on, and a Cloudinary account.

```bash
git clone https://github.com/punkpixel42/KSAS.git
cd KSAS
npm install
cp .env.example .env
```

Fill in `.env`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SEND_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

Run it:

```bash
npm run dev
```

Opens at `http://localhost:3000`.

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | TypeScript type-check |

---

## How Each Role Works

**Student:** Pick "Student" on the landing page, log in, see all active and upcoming sessions on the dashboard (not just one). Cross-school courses are clearly flagged. Go to Check-In, scan the QR, confirm the class details, then check in. Device, GPS, IP, and enrollment are all validated. Feedback is fully anonymous — no student ID stored. They can check their history and analytics anytime.

**Lecturer:** Pick "Lecturer," log in, start a session from the dashboard — choose course, room, topic, security settings. The live QR code refreshes every 5 seconds. Watch check-ins come in. End the session when done. Attendance archives and a CSV becomes available. Check analytics, risk alerts, and reports through the semester.

**Admin:** Log in. Create, edit, suspend, or delete users. Registration numbers are parsed to auto-suggest school/department on account creation. Set up courses and assign lecturers. Manage school code prefix mappings (e.g. LAW → School of Law) without a code change. Browse archived sessions on Cloudinary. Pull organisation-wide reports and export them as CSV.

---

## How the Key Pieces Work

**Registration number parsing:** Every student registration number (e.g. `LAW/M/1714/05/26`) is parsed on account creation to extract the school prefix. This feeds into session filtering — students see sessions relevant to their school first, with cross-school electives clearly flagged.

**Attendance engine:** Lecturer starts session → QR code with TOTP generated → student scans → pre-confirmation screen shows course, room, lecturer, and time → student confirms → five layers of validation + enrollment check → attendance logged to a Firestore subcollection → every connected client sees it in real time.

**Live QR system:** Each QR embeds a TOTP token valid for 5 seconds. When the timer expires, a new token replaces it. A countdown and flash animation tell everyone in the room when the switch happens.

**Anonymous feedback:** Students rate sessions from their dashboard. No student ID, name, or email is stored — only the session reference, rating, and optional comment. Admins see aggregated feedback per lecturer, not per student.

**School code mapping:** Admins configure prefix-to-school mappings through a dedicated settings page. Mappings are stored in Firestore so they can be edited without a redeploy. Existing student accounts can be backfilled in one click.

**Analytics:** Charts pull from Firestore in real time. Weekly trends, per-course breakdowns, an effectiveness score (60% attendance, 30% feedback, 10% consistency), and a comparison against the university average.

**Risk monitoring:** Students below 75% attendance get flagged. High risk is under 50%. Medium risk is 50–75%. The system compares early-semester and late-semester performance to spot downward trends.

**Reporting:** Filter by course and date range. Export includes student names, IDs, timestamps, room assignments, and device fingerprints.

---

## License

For educational and institutional use.
