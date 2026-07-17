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

## WhatsApp Business notifications

The app now supports sending absence notifications via WhatsApp. When a student is marked absent, the UI can capture:

- `subjectName`
- `startTime`
- `endTime`

These values are used to render a message like:

`[STUDENT_NAME] has missed [CLASS_SUBJECT_NAME] from [START_TIME] to [END_TIME]`

Configure WhatsApp credentials in `server/.env`:

```env
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_API_VERSION=v17.0
# Optional override if you need a custom endpoint URL
WHATSAPP_API_URL=
```

The frontend includes a `Login with WhatsApp` button, and absent students marked in the attendance view will automatically enqueue WhatsApp alert jobs for parents.

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
- `POST /api/attendance/queue-absent-whatsapp-alerts`
- `GET /api/gateway/status`
- `GET /api/whatsapp/status`
- `POST /api/whatsapp/login`
- `GET /api/sms-queue`

## WhatsApp Cloud API Integration Flow

This application supports sending absent student alerts to parents via WhatsApp using the official **WhatsApp Cloud API** (hosted by Meta).

### Step-by-Step Integration & Flow:

#### Step 1: Set Up Meta Developer Account
1. Go to the [Meta for Developers Portal](https://developers.facebook.com/) and register as a developer.
2. Click **Create App**, select **Other** -> **Business**, and choose a name for your app.
3. In the App Dashboard, scroll down to **WhatsApp** and click **Set up**.
4. Link your Meta Business Account (or let it auto-create a default test account).

#### Step 2: Obtain API Credentials
1. In the Meta developer portal sidebar, navigate to **WhatsApp** -> **API Setup**.
2. Locate the following configurations:
   - **Temporary access token** (useful for immediate testing; expires in 24 hours).
   - **Phone Number ID** (a unique ID for your sender phone number).
3. To send test messages in sandbox mode, register your own phone number in the **To** recipient list.
4. *(For Production)* Register a real phone number, verify it, and generate a **Permanent Access Token** via the Meta Business Suite system user console (assigning it `whatsapp_business_messaging` permission).

#### Step 3: Configure Environment Variables
Open your `server/.env` file and set the following variables:
```env
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_API_VERSION=v17.0
```

#### Step 4: Connect the Gateway
1. Run the app (`npm run dev`) and access the frontend dashboard at [http://localhost:5173](http://localhost:5173).
2. Look at the top toolbar. The WhatsApp status badge will show **Configure WhatsApp** (if env vars are empty) or **Not connected** (if they are configured but not verified).
3. Click the **Login with WhatsApp** button. The server validates the configuration against Meta's Graph API.
4. Once verified, the badge will turn green and display **WhatsApp ready**.

#### Step 5: Queue & Send WhatsApp Alerts
1. Go to the **Attendance** tab and mark students absent.
2. Fill out the optional **Subject name**, **Start time**, and **End time** fields in the attendance toolbar (e.g. *Science*, *10:00*, *11:00*). These fields will automatically fill the template variables.
3. Click **Send absent WhatsApp alerts**.
4. The backend generates messages using the template: `{name} has missed {subjectName} from {startTime} to {endTime}`.
5. The alerts are added as jobs to the queue. The background queue processor will pick them up, submit them to the WhatsApp Cloud API, and report statuses/errors under the **SMS Queue** tab.

## Local WhatsApp Web JS Gateway (Alternative)

Instead of the official WhatsApp Cloud API (which requires a Meta Business Account), you can route alerts through a local browser session using `whatsapp-web.js`. This spins up a Chromium browser instance locally and interacts directly with WhatsApp Web.

### Setup & Run:

1. **Install Dependencies**:
   ```bash
   cd whatsapp-service
   npm install
   ```

2. **Configure Environment Variables**:
   Create `whatsapp-service/.env`:
   ```env
   PORT=4001
   WHATSAPP_SERVICE_API_KEY=absent_alert_secret_key_2026
   ```

3. **Configure Main Server to Route to Local Gateway**:
   Open `server/.env` and update:
   ```env
   WHATSAPP_API_URL=http://localhost:4001/send-alert
   WHATSAPP_ACCESS_TOKEN=absent_alert_secret_key_2026
   ```

4. **Launch the Gateway**:
   ```bash
   npm start
   ```
   * On initial run, a browser window will open (or a QR code will print in the console). Scan this QR code using the WhatsApp app on your phone.
   * Session state is persisted in `whatsapp-service/.wwebjs_auth/session`, meaning subsequent launches will automatically authenticate without scanning.
   * You can configure the gateway to run in headless or windowed mode inside [whatsapp-service/server.js](file:///Users/azhaankhan/Absent-Alert-1/whatsapp-service/server.js) under the `puppeteerConfig` parameters.
