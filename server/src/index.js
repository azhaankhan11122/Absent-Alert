import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonStore } from './store.js';
import { AdbSmsGateway } from './services/adbGateway.js';
import { WhatsAppGateway } from './services/whatsappGateway.js';
import { SmsQueueService } from './services/smsQueue.js';
import { studentsRouter } from './routes/students.js';
import { attendanceRouter } from './routes/attendance.js';
import { metaRouter } from './routes/meta.js';
import { teachersRouter } from './routes/teachers.js';
import { teacherAttendanceRouter } from './routes/teacherAttendance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = {
  port: Number(process.env.PORT || 4000),
  dataFile: process.env.DATA_FILE || path.join(__dirname, 'data/store.json'),
  queueIntervalMs: Number(process.env.QUEUE_INTERVAL_MS || 5000),
  maxSmsAttempts: Number(process.env.MAX_SMS_ATTEMPTS || 5),
  adbPath: process.env.ADB_PATH || 'adb',
  adbSerial: process.env.ADB_SERIAL || '',
  gatewayMode: process.env.SMS_GATEWAY_MODE || 'broadcast',
  gatewayAction: process.env.SMS_GATEWAY_ACTION || 'com.absentalert.SEND_SMS',
  gatewayPackage: process.env.SMS_GATEWAY_PACKAGE || '',
  whatsAppAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  whatsAppPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  whatsAppApiUrl: process.env.WHATSAPP_API_URL || '',
  whatsAppApiVersion: process.env.WHATSAPP_API_VERSION || 'v17.0'
};

const store = new JsonStore(config.dataFile);
await store.init();
const gateway = new AdbSmsGateway(config);
const whatsappGateway = new WhatsAppGateway(config);
const smsQueue = new SmsQueueService(store, gateway, whatsappGateway, config);
smsQueue.start();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'absent-alert-api' }));
app.use('/api/students', studentsRouter(store));
app.use('/api/attendance', attendanceRouter(store, smsQueue));
app.use('/api/teachers', teachersRouter(store));
app.use('/api/teacher-attendance', teacherAttendanceRouter(store));
app.use('/api', metaRouter(store, gateway, smsQueue, whatsappGateway));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Absent Alert API listening on http://localhost:${config.port}`);
});
