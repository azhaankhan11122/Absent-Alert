# Absent Alert

Full-stack student attendance manager with CSV/XLSX import, attendance dashboard, trend visualization, SMS queueing, and wired Android USB SMS gateway support.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Durable app data: atomic JSON store at `server/src/data/store.json` for the MVP
- File imports: CSV and Excel (`.xlsx`)
- SMS transport: ADB to a USB-connected Android phone / gateway service

## Run locally

```bash
npm run install:all
cp server/.env.example server/.env
npm run dev
```

Open the Vite URL shown by the client, usually <http://localhost:5173>. The API runs at <http://localhost:4000>.

## Student import format

CSV/XLSX headers can use any of these names:

- `name` or `Name`
- `rollNo`, `roll`, `Roll No`, or `roll_no`
- `className`, `class`, `Class`, or `section`
- `parentName`, `Parent Name`, or `guardianName`
- `parentPhone`, `phone`, `mobile`, `Parent Phone`, or `Mobile`

Existing students are updated when `rollNo + className` matches.

## Wired Android SMS gateway

The backend keeps a persistent SMS queue and retries failed sends with exponential backoff. It checks `adb devices` before every send.

### Recommended automated mode

Install a small Android gateway app on the phone that exposes a broadcast receiver/service with `SEND_SMS` permission. Configure:

```env
SMS_GATEWAY_MODE=broadcast
SMS_GATEWAY_ACTION=com.absentalert.SEND_SMS
SMS_GATEWAY_PACKAGE=com.your.gateway.package # optional
ADB_PATH=adb
ADB_SERIAL=                   # optional if only one phone is connected
```

The backend sends:

```bash
adb shell am broadcast -a com.absentalert.SEND_SMS --es phone "<number>" --es message "<message>"
```

The Android gateway app should receive those extras and send the SMS through the BSNL SIM in that phone.

### Test / manual fallback mode

```env
SMS_GATEWAY_MODE=intent
```

This opens the native Android SMS composer via ADB. It is useful for testing phone connectivity but may require user confirmation and is not fully automated on most Android versions.

## Reliability behavior

- Queue statuses: `queued`, `processing`, `sent`, `failed`
- `MAX_SMS_ATTEMPTS` controls retry attempts
- `QUEUE_INTERVAL_MS` controls polling cadence
- If ADB/device is disconnected, the job returns to `queued` with exponential backoff
- Failed jobs can be retried from the dashboard

## Key API endpoints

- `GET/POST /api/students`
- `PUT/DELETE /api/students/:id`
- `POST /api/students/import`
- `GET /api/attendance`
- `POST /api/attendance/mark`
- `GET /api/attendance/summary`
- `GET /api/attendance/trends`
- `POST /api/attendance/queue-absent-alerts`
- `GET /api/gateway/status`
- `GET /api/sms-queue`
