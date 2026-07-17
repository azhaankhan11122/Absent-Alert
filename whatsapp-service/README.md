# WhatsApp Notification Gateway

A lightweight, standalone microservice that acts as a WhatsApp Web API gateway using `whatsapp-web.js` and Express. It enables sending student attendance alerts securely with a persistent authentication session.

## Features

- **Session Persistence**: Uses `LocalAuth` to store session tokens, eliminating the need to re-scan the QR code upon server restarts.
- **Terminal QR Code**: Renders a QR code directly in the terminal during the initial setup.
- **Safety Delays**: Implements a queueing system with a random delay (5 to 15 seconds) between message dispatch times to prevent account flagging/bans by Meta.
- **Number Validation**: Automatic number cleansing (resolving 10-digit formats to include country codes) and pre-flight validation to ensure the target phone number is registered on WhatsApp.
- **Access Control**: Secure `/send-alert` endpoint utilizing an API key check middleware.

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   cd whatsapp-service
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or modify the pre-created one):
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set:
   - `PORT`: Port to run this service on (defaults to `4001`).
   - `WHATSAPP_SERVICE_API_KEY`: Secret string to authorize requests.

---

## How to Run

Start the service:
```bash
npm start
```

### Initial Authentication
On the first run, a QR code will print in the terminal:
1. Open WhatsApp on your phone.
2. Go to **Linked Devices** -> **Link a Device**.
3. Scan the QR code in the terminal.
4. Once connected, your session will persist in the `.wwebjs_auth/` directory.

---

## API Documentation

### 1. Send Alert
- **Endpoint**: `POST /send-alert`
- **Headers**:
  - `Content-Type: application/json`
  - `x-api-key: <your_secret_key>`
- **Request Body**:
  ```json
  {
    "phoneNumber": "9876543210",
    "message": "Aman has been marked absent today."
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "status": "sent",
    "details": {
      "success": true,
      "messageId": "true_919876543210@c.us_3EB0...",
      "recipient": "919876543210@c.us"
    }
  }
  ```

### 2. Service Status
- **Endpoint**: `GET /status`
- **Response**:
  ```json
  {
    "status": "ready",
    "queueLength": 0,
    "isProcessing": false
  }
  ```
