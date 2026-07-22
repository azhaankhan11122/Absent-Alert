import express from 'express';

export function metaRouter(store, gateway, smsQueue, whatsappGateway) {
  const router = express.Router();

  router.get('/classes', async (_req, res) => {
    const data = await store.read();
    res.json([...new Set(data.students.map((student) => student.className).filter(Boolean))].sort());
  });

  router.get('/settings', async (_req, res) => {
    const data = await store.read();
    res.json(data.settings);
  });

  router.put('/settings', async (req, res) => {
    const settings = await store.update((data) => {
      data.settings = { ...data.settings, ...req.body };
      return data.settings;
    });
    res.json(settings);
  });

  router.get('/gateway/status', async (_req, res) => {
    res.json(await gateway.getStatus());
  });

  router.get('/whatsapp/status', async (_req, res) => {
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
  });

  router.post('/whatsapp/login', async (_req, res) => {
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
  });

  router.get('/sms-queue', async (_req, res) => {
    res.json(await smsQueue.list());
  });

  router.post('/sms-queue/:id/retry', async (req, res) => {
    const job = await smsQueue.retry(req.params.id);
    if (!job) return res.status(404).json({ error: 'SMS job not found.' });
    res.json(job);
  });

  return router;
}
