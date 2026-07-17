import express from 'express';

export function metaRouter(store, gateway, smsQueue) {
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
