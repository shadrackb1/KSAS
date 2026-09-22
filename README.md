# KSAS

<img src="./assets/header.svg" width="100%" alt="KSAS — QR expires every 5s. Device bound. Screenshot useless." />

Kabarak Smart Attendance System. Lecture halls fill up, roll calls waste twenty minutes, and a photo of someone else's QR code has been good enough to fake a seat. KSAS closes that hole.

**Hard constraint it answers:** screenshot fraud. A captured QR is worthless five seconds later, and a scan from the wrong phone fails the device check even if the code is still live.

## How check-in works

1. Lecturer starts a session and puts a live QR on the projector.
2. The code refreshes every 5 seconds and carries a one-time token.
3. Student scans. The server checks device fingerprint, enrollment, optional GPS, and optional campus IP.
4. Attendance lands. Screenshots of old codes fail. Shared phones fail.

Five layers on every scan: live token, short TTL, device binding, enrollment match, then optional location and network checks.

## Roles

| Role | What they see |
| --- | --- |
| Student | Per-course percentages, trend charts, class averages. Feedback is anonymous. |
| Lecturer | Check-ins in real time, risk alerts under 75%, CSV export. |
| Admin | Users, courses, school codes, archived sessions. |

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Firebase (Auth + Firestore) · TanStack Query · Recharts · `otpauth` / `crypto-js` for token work · Vitest + Playwright + k6 for tests and load.

## Run locally

```bash
npm install
cp .env.example .env   # fill Firebase keys
npm run dev            # http://localhost:3000
```

Other scripts worth knowing: `npm run build`, `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`. Load tests under `load-tests/` (`npm run loadtest:checkin`). Firestore rules and indexes deploy with `npm run deploy:firebase` and `npm run deploy:indexes`.

## Links

- Repo: https://github.com/shadrackb1/KSAS
- Related: [ussd-attendance](https://github.com/shadrackb1/ussd-attendance) for handsets that cannot scan a QR
- Related: [playground](https://shadrackb1.github.io/playground/) for interaction demos

## License

MIT
