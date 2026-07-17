import express from 'express';
import { newId } from '../store.js';
import { todayISO } from '../utils/normalize.js';

export function attendanceRouter(store, smsQueue) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { date = todayISO(), className = '' } = req.query;
    const data = await store.read();
    const rows = data.students
      .filter((student) => !className || student.className === className)
      .map((student) => {
        const record = data.attendance.find((item) => item.studentId === student.id && item.date === date);
        return { student, status: record?.status || 'unmarked', recordId: record?.id || null, date };
      });
    res.json(rows);
  });

  router.post('/mark', async (req, res) => {
    const { studentId, date = todayISO(), status } = req.body;
    if (!studentId || !['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ error: 'studentId and valid status (present, absent, late) are required.' });
    }
    const record = await store.update((data) => {
      if (!data.students.some((student) => student.id === studentId)) return null;
      let row = data.attendance.find((item) => item.studentId === studentId && item.date === date);
      if (!row) {
        row = { id: newId('att'), studentId, date, status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        data.attendance.push(row);
      } else {
        row.status = status;
        row.updatedAt = new Date().toISOString();
      }
      return row;
    });
    if (!record) return res.status(404).json({ error: 'Student not found.' });
    res.json(record);
  });

  router.post('/bulk', async (req, res) => {
    const { date = todayISO(), entries = [] } = req.body;
    const saved = await store.update((data) => {
      const out = [];
      for (const entry of entries) {
        if (!['present', 'absent', 'late'].includes(entry.status)) continue;
        if (!data.students.some((student) => student.id === entry.studentId)) continue;
        let row = data.attendance.find((item) => item.studentId === entry.studentId && item.date === date);
        if (!row) {
          row = { id: newId('att'), studentId: entry.studentId, date, status: entry.status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          data.attendance.push(row);
        } else {
          row.status = entry.status;
          row.updatedAt = new Date().toISOString();
        }
        out.push(row);
      }
      return out;
    });
    res.json(saved);
  });

  router.post('/queue-absent-alerts', async (req, res) => {
    const queued = await smsQueue.enqueueAbsentAlerts(req.body);
    res.status(201).json({ queuedCount: queued.length, queued });
  });

  router.get('/summary', async (req, res) => {
    const { date = todayISO(), className = '' } = req.query;
    const data = await store.read();
    const students = data.students.filter((student) => !className || student.className === className);
    const counts = { total: students.length, present: 0, absent: 0, late: 0, unmarked: 0 };
    for (const student of students) {
      const status = data.attendance.find((item) => item.studentId === student.id && item.date === date)?.status || 'unmarked';
      counts[status] += 1;
    }
    res.json(counts);
  });

  router.get('/trends', async (req, res) => {
    const { className = '', days = 14 } = req.query;
    const data = await store.read();
    const dates = [...new Set(data.attendance.map((item) => item.date))].sort().slice(-Number(days));
    const points = dates.map((date) => {
      const studentIds = data.students.filter((student) => !className || student.className === className).map((student) => student.id);
      const records = data.attendance.filter((item) => item.date === date && studentIds.includes(item.studentId));
      const total = studentIds.length || 1;
      return {
        date,
        present: records.filter((item) => item.status === 'present').length,
        absent: records.filter((item) => item.status === 'absent').length,
        late: records.filter((item) => item.status === 'late').length,
        attendancePercent: Math.round((records.filter((item) => item.status === 'present' || item.status === 'late').length / total) * 100)
      };
    });
    res.json(points);
  });

  return router;
}
