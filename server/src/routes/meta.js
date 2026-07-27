import express from 'express';
import { newId } from '../store.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function metaRouter(store, gateway, smsQueue, whatsappGateway) {
  const router = express.Router();

  router.get('/classes', asyncHandler(async (_req, res) => {
    const data = await store.read();
    res.json([...new Set(data.students.map((student) => student.className).filter(Boolean))].sort());
  }));

  router.get('/settings', asyncHandler(async (_req, res) => {
    const data = await store.read();
    res.json(data.settings);
  }));

  router.put('/settings', asyncHandler(async (req, res) => {
    const { schoolName, absentSmsTemplate, absentWhatsAppTemplate, customStudentFields, timetableSlots } = req.body;
    const result = await store.update((data) => {
      data.settings = {
        ...data.settings,
        schoolName: schoolName !== undefined ? String(schoolName) : data.settings.schoolName,
        absentSmsTemplate: absentSmsTemplate !== undefined ? String(absentSmsTemplate) : data.settings.absentSmsTemplate,
        absentWhatsAppTemplate: absentWhatsAppTemplate !== undefined ? String(absentWhatsAppTemplate) : data.settings.absentWhatsAppTemplate,
        customStudentFields: customStudentFields !== undefined ? customStudentFields : data.settings.customStudentFields,
        timetableSlots: timetableSlots !== undefined ? timetableSlots : data.settings.timetableSlots
      };
      return data.settings;
    });
    res.json(result);
  }));

  router.get('/gateway/status', asyncHandler(async (_req, res) => {
    res.json(await gateway.getStatus());
  }));

  router.get('/whatsapp/status', asyncHandler(async (_req, res) => {
    try {
      await whatsappGateway.validateConfig();
      const data = await store.read();
      
      let connected = Boolean(data.settings.whatsAppAuthenticated);
      let qr = null;
      let isLocal = false;

      if (whatsappGateway.config.whatsAppApiUrl && whatsappGateway.config.whatsAppApiUrl.includes('localhost')) {
        isLocal = true;
        try {
          const statusUrl = whatsappGateway.config.whatsAppApiUrl.replace(/\/send-alert\/?$/, '/status');
          const response = await fetch(statusUrl);
          if (response.ok) {
            const body = await response.json();
            connected = body.status === 'ready';
            qr = body.qr || null;
            
            if (data.settings.whatsAppAuthenticated !== connected) {
              await store.update((state) => {
                state.settings.whatsAppAuthenticated = connected;
                return state.settings;
              });
            }
          }
        } catch (err) {
          console.error('Failed to fetch status from local WhatsApp gateway:', err.message);
          connected = false;
        }
      }

      res.json({
        ok: true,
        provider: isLocal ? 'whatsapp-web' : 'whatsapp',
        connected,
        configured: true,
        qr,
        phoneNumberId: whatsappGateway.config.whatsAppPhoneNumberId || ''
      });
    } catch (error) {
      const data = await store.read();
      res.json({
        ok: false,
        provider: 'whatsapp',
        connected: Boolean(data.settings.whatsAppAuthenticated),
        configured: false,
        error: error.message
      });
    }
  }));

  router.post('/whatsapp/login', asyncHandler(async (_req, res) => {
    try {
      await whatsappGateway.validateConfig();
      const data = await store.read();
      let connected = false;
      let qr = null;
      let isLocal = false;

      if (whatsappGateway.config.whatsAppApiUrl && whatsappGateway.config.whatsAppApiUrl.includes('localhost')) {
        isLocal = true;
        try {
          const statusUrl = whatsappGateway.config.whatsAppApiUrl.replace(/\/send-alert\/?$/, '/status');
          const response = await fetch(statusUrl);
          if (response.ok) {
            const body = await response.json();
            connected = body.status === 'ready';
            qr = body.qr || null;
          }
        } catch (err) {
          console.error('Failed to fetch status from local WhatsApp gateway:', err.message);
        }
      }

      if (isLocal) {
        await store.update((state) => {
          state.settings.whatsAppAuthenticated = connected;
          return state.settings;
        });
        return res.json({
          connected,
          configured: true,
          qr,
          provider: 'whatsapp-web'
        });
      }

      const settings = await store.update((state) => {
        state.settings.whatsAppAuthenticated = true;
        state.settings.whatsAppPhoneNumberId = whatsappGateway.config.whatsAppPhoneNumberId || state.settings.whatsAppPhoneNumberId || '';
        return state.settings;
      });
      res.json({
        connected: true,
        configured: true,
        phoneNumberId: settings.whatsAppPhoneNumberId || ''
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  }));

  router.post('/whatsapp/logout', asyncHandler(async (_req, res) => {
    try {
      let isLocal = false;
      let hasConfig = false;
      try {
        await whatsappGateway.validateConfig();
        hasConfig = true;
      } catch (e) {
        console.warn('WhatsApp configuration is invalid during logout:', e.message);
      }

      if (hasConfig && whatsappGateway.config.whatsAppApiUrl && whatsappGateway.config.whatsAppApiUrl.includes('localhost')) {
        isLocal = true;
        try {
          const logoutUrl = whatsappGateway.config.whatsAppApiUrl.replace(/\/send-alert\/?$/, '/logout');
          const response = await fetch(logoutUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${whatsappGateway.config.whatsAppAccessToken}`,
              'Content-Type': 'application/json'
            }
          });
          if (!response.ok) {
            const body = await response.text();
            console.error(`Local WhatsApp gateway logout failed: ${body}`);
          }
        } catch (err) {
          console.error('Failed to log out from local WhatsApp gateway:', err.message);
        }
      }

      const settings = await store.update((state) => {
        state.settings.whatsAppAuthenticated = false;
        return state.settings;
      });

      res.json({
        ok: true,
        connected: false,
        configured: hasConfig,
        whatsAppAuthenticated: false
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  }));

  router.get('/sms-queue', asyncHandler(async (_req, res) => {
    res.json(await smsQueue.list());
  }));

  router.post('/sms-queue/:id/retry', asyncHandler(async (req, res) => {
    const job = await smsQueue.retry(req.params.id);
    if (!job) return res.status(404).json({ error: 'SMS job not found.' });
    res.json(job);
  }));

  router.post('/sms-queue/:id/approve', asyncHandler(async (req, res) => {
    const job = await smsQueue.approve(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json(job);
  }));

  router.post('/sms-queue/approve-all', asyncHandler(async (_req, res) => {
    const approved = await smsQueue.approveAll();
    res.json({ approvedCount: approved.length, approved });
  }));

  router.delete('/sms-queue/:id', asyncHandler(async (req, res) => {
    const deleted = await smsQueue.deleteJob(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Job not found.' });
    res.status(204).end();
  }));

  router.get('/timetable', asyncHandler(async (_req, res) => {
    const data = await store.read();
    const list = data.timetable || [];
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sorted = list.slice().sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return String(a.startTime).localeCompare(b.startTime);
    });
    res.json(sorted);
  }));

  router.post('/timetable', asyncHandler(async (req, res) => {
    const { day, subjectName, startTime, endTime, className, year } = req.body;
    if (!day || !subjectName || !startTime || !endTime || !className || !year) {
      return res.status(400).json({ error: 'day, subjectName, startTime, endTime, className, and year are required.' });
    }
    const created = await store.update((data) => {
      if (!data.timetable) data.timetable = [];
      const row = {
        id: newId('tt'),
        day,
        subjectName: String(subjectName).trim(),
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        className: String(className).trim(),
        year: String(year).trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.timetable.push(row);
      return row;
    });
    res.status(201).json(created);
  }));

  router.delete('/timetable/:id', asyncHandler(async (req, res) => {
    const id = req.params.id;
    const deleted = await store.update((data) => {
      if (!data.timetable) return null;
      const index = data.timetable.findIndex((item) => item.id === id);
      if (index === -1) return null;
      const [removed] = data.timetable.splice(index, 1);
      return removed;
    });
    if (!deleted) return res.status(404).json({ error: 'Timetable slot not found.' });
    res.status(204).end();
  }));

  return router;
}
