# KSAS â€” Kabarak Smart Attendance System

<img src="./assets/header.svg" width="100%" alt="header" />


Attendance fraud is a real problem at universities. KSAS fixes it with QR codes that expire every five seconds, device fingerprinting, and a five-layer check that runs every time a student taps "Check In." Built for Kabarak University. React, TypeScript, Firebase.

---

## What It Does

**Students** scan a QR code to check in. The system checks their device, location, and network before recording attendance. They can track their own stats â€” per-course percentages, trends, how they compare to the class average. Registration numbers are parsed to auto-derive school affiliation, which helps surface relevant sessions and flag cross-school courses. Feedback is fully anonymous.

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
â”œâ”€â”€ App.tsx              Routes for every role
â”œâ”€â”€ main.tsx             Entry point
â”œâ”€â”€ index.css            Theme, utilities, animations
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ ErrorBoundary.tsx    Catches render errors
â”‚   â””â”€â”€ layout/
â”‚       â”œâ”€â”€ AppLayout.tsx    Sidebar + topbar + mobile nav
â”‚       â”œâ”€â”€ DesktopSidebar.tsx  Desktop nav
â”‚       â”œâ”€â”€ MobileNav.tsx    Bottom tab bar
â”‚       â””â”€â”€ TopAppBar.tsx    Notifications, profile
â”œâ”€â”€ hooks/
â”‚   â”œâ”€â”€ useAuth.ts           localStorage auth
â”‚   â”œâ”€â”€ useCloudinaryCache.ts Cloudinary caching
â”‚   â””â”€â”€ useFirestoreRealtime.ts Real-time Firestore hook
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ analytics.ts         Stats and scoring
â”‚   â”œâ”€â”€ auth.ts              Password hashing
â”‚   â”œâ”€â”€ backfillSchoolCodes.ts  One-time migration for school codes
â”‚   â”œâ”€â”€ cloudinary.ts        Upload/download
â”‚   â”œâ”€â”€ collections.ts       Firestore collection names
â”‚   â”œâ”€â”€ csvExport.ts         CSV generation
â”‚   â”œâ”€â”€ db.ts                checkIn, archive, close, enrollment check
â”‚   â”œâ”€â”€ firebase.ts          Firebase init
â”‚   â”œâ”€â”€ gamification.ts      XP, levels, ranks, streaks
â”‚   â”œâ”€â”€ regNumberParser.ts   Registration number â†’ school code parser
â”‚   â”œâ”€â”€ schoolCodes.ts       School code mapping CRUD (Firestore)
â”‚   â”œâ”€â”€ security.ts          Anti-fraud validation
â”‚   â”œâ”€â”€ totp.ts              TOTP generation
â”‚   â””â”€â”€ utils.ts             Helpers
â””â”€â”€ pages/
    â”œâ”€â”€ RoleSelection.tsx    Login landing
    â”œâ”€â”€ admin/
    â”‚   â”œâ”€â”€ Dashboard.tsx
    â”‚   â”œâ”€â”€ CreateUser.tsx       Auto-derives schoolCode from reg number
    â”‚   â”œâ”€â”€ SchoolCodes.tsx      School code mapping management
    â”‚   â”œâ”€â”€ CourseManagement.tsx
    â”‚   â”œâ”€â”€ SessionArchive.tsx
    â”‚   â”œâ”€â”€ Analytics.tsx
    â”‚   â””â”€â”€ Reports.tsx
    â”œâ”€â”€ lecturer/
    â”‚   â”œâ”€â”€ Dashboard.tsx
    â”‚   â”œâ”€â”€ LiveSession.tsx      Live QR + manual attendance
    â”‚   â”œâ”€â”€ CourseManagement.tsx
    â”‚   â””â”€â”€ RiskMonitor.tsx
    â””â”€â”€ student/
        â”œâ”€â”€ Dashboard.tsx        All active/upcoming sessions, anonymous feedback
        â”œâ”€â”€ CheckIn.tsx          Pre-confirmation before check-in
        â”œâ”€â”€ Courses.tsx
        â””â”€â”€ Analytics.tsx
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

**Student:** Pick "Student" on the landing page, log in, see all active and upcoming sessions on the dashboard (not just one). Cross-school courses are clearly flagged. Go to Check-In, scan the QR, confirm the class details, then check in. Device, GPS, IP, and enrollment are all validated. Feedback is fully anonymous â€” no student ID stored. They can check their history and analytics anytime.

**Lecturer:** Pick "Lecturer," log in, start a session from the dashboard â€” choose course, room, topic, security settings. The live QR code refreshes every 5 seconds. Watch check-ins come in. End the session when done. Attendance archives and a CSV becomes available. Check analytics, risk alerts, and reports through the semester.

**Admin:** Log in. Create, edit, suspend, or delete users. Registration numbers are parsed to auto-suggest school/department on account creation. Set up courses and assign lecturers. Manage school code prefix mappings (e.g. LAW â†’ School of Law) without a code change. Browse archived sessions on Cloudinary. Pull organisation-wide reports and export them as CSV.

---

## How the Key Pieces Work

**Registration number parsing:** Every student registration number (e.g. `LAW/M/1714/05/26`) is parsed on account creation to extract the school prefix. This feeds into session filtering â€” students see sessions relevant to their school first, with cross-school electives clearly flagged.

**Attendance engine:** Lecturer starts session â†’ QR code with TOTP generated â†’ student scans â†’ pre-confirmation screen shows course, room, lecturer, and time â†’ student confirms â†’ five layers of validation + enrollment check â†’ attendance logged to a Firestore subcollection â†’ every connected client sees it in real time.

**Live QR system:** Each QR embeds a TOTP token valid for 5 seconds. When the timer expires, a new token replaces it. A countdown and flash animation tell everyone in the room when the switch happens.

**Anonymous feedback:** Students rate sessions from their dashboard. No student ID, name, or email is stored â€” only the session reference, rating, and optional comment. Admins see aggregated feedback per lecturer, not per student.

**School code mapping:** Admins configure prefix-to-school mappings through a dedicated settings page. Mappings are stored in Firestore so they can be edited without a redeploy. Existing student accounts can be backfilled in one click.

**Analytics:** Charts pull from Firestore in real time. Weekly trends, per-course breakdowns, an effectiveness score (60% attendance, 30% feedback, 10% consistency), and a comparison against the university average.

**Risk monitoring:** Students below 75% attendance get flagged. High risk is under 50%. Medium risk is 50â€“75%. The system compares early-semester and late-semester performance to spot downward trends.

**Reporting:** Filter by course and date range. Export includes student names, IDs, timestamps, room assignments, and device fingerprints.

---

## License

For educational and institutional use.
