<div align="center">
  <img src="client/public/logo.svg" alt="Absent Alert Logo" width="120" />
  <h1>Absent Alert</h1>
  <p><b>Next-generation student attendance management, redefined.</b></p>
</div>

---

**Absent Alert** is a full-stack, hyper-modern attendance manager equipped with real-time trend visualization, customizable timetables, teacher tracking, and robust automated alerts via WhatsApp and USB-tethered SMS gateways.

## ✨ Features

- 🌒 **End-to-End Dark Mode:** A sleek, fully dynamic dark mode with satisfying micro-animations and fluid abstract background motion graphics.
- 📊 **Advanced Dashboard:** Real-time visual trends, intuitive student search, and fully customizable student data fields.
- 📅 **Timetables & Teachers:** Interactive drag-and-drop timetable building and detailed daily teacher attendance metrics.
- 💬 **Multi-Channel Alerts:** Reach parents instantly via the WhatsApp Cloud API, a local WhatsApp Web JS gateway, or a fallback USB-tethered Android SMS gateway.
- 📥 **Bulk Imports:** Effortlessly import student rosters from CSV or Excel (`.xlsx`) files.
- 💾 **Durable Storage:** Fast, atomic JSON store architecture for the MVP—no complex database setup required.

---

## 🚀 Quick Start

```bash
# Install dependencies for both client and server
npm run install:all

# Configure environment variables
cp server/.env.example server/.env

# Launch the dev environment
npm run dev
```

Open the Vite URL shown by the client (usually `http://localhost:5173`). The API runs on port `4000`.

---

## 📡 Alert Systems

### WhatsApp Web JS Gateway (Local Proxy)

Instead of the official WhatsApp Cloud API, you can route alerts through a local Chromium browser instance that interacts directly with WhatsApp Web.

1. **Install Dependencies:** `cd whatsapp-service && npm install`
2. **Configure:** Create `whatsapp-service/.env` with `PORT=4001` and `WHATSAPP_SERVICE_API_KEY=your_secret`.
3. **Route Traffic:** Update `server/.env` to point `WHATSAPP_API_URL=http://localhost:4001/send-alert`.
4. **Launch:** Run `npm start` in the service folder and scan the generated QR code with your phone. 

### WhatsApp Cloud API Integration

Absent Alert fully supports the official Meta WhatsApp Cloud API for enterprise-grade message delivery. Set the following in your `server/.env`:
```env
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_API_VERSION=v17.0
```
Templates automatically parse context from the app: `{name} has missed {subjectName} from {startTime} to {endTime}`.

### Wired Android SMS Gateway (Fallback)

For offline or rural deployments, connect an Android device via USB. The backend manages a persistent SMS queue with exponential backoff and uses `adb` to bridge messages to the device's native SMS capabilities.

- **Automated Broadcast Mode:** `SMS_GATEWAY_MODE=broadcast` (Requires a small companion Android app).
- **Test / Intent Mode:** `SMS_GATEWAY_MODE=intent` (Opens the native SMS composer).

---

## 🛠 Architecture & API

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **State & Queue:** Polling processor with state lifecycle (`pending` -> `queued` -> `processing` -> `sent` | `failed`)

### Key Endpoints
- `GET/POST /api/students` — Roster management and imports
- `POST /api/attendance/mark` — Mark attendance
- `GET /api/attendance/trends` — Dashboard analytics
- `POST /api/attendance/queue-absent-whatsapp-alerts` — Enqueue targeted WhatsApp messages
- `GET /api/whatsapp/status` — Real-time gateway status monitoring
