import express from 'express';
import { newId } from '../store.js';
import { todayISO } from '../utils/normalize.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function attendanceRouter(store, smsQueue) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const { date = todayISO(), className = '', year = '' } = req.query;
    const data = await store.read();
    const rows = data.students
      .filter((student) => {
        const matchesClass = !className || student.className === className;
        const matchesYear = !year || student.year === year;
        return matchesClass && matchesYear;
      })
      .map((student) => {
        const record = data.attendance.find((item) => item.studentId === student.id && item.date === date);
        return { student, status: record?.status || 'present', recordId: record?.id || null, date };
      });
    res.json(rows);
  }));

  router.post('/mark', asyncHandler(async (req, res) => {
    const { studentId, date = todayISO(), status } = req.body;
    if (!studentId || !['present', 'absent', 'late'].includes(status)) {
      return res.status(400).json({ error: 'studentId and valid status (present, absent, late) are required.' });
    }
    const record = await store.update((data) => {
      const student = data.students.find((item) => item.id === studentId);
      if (!student) return null;
      let row = data.attendance.find((item) => item.studentId === student.id && item.date === date);
      if (!row) {
        row = {
          id: newId('att'),
          studentId,
          date,
          status,
          subjectName: status === 'absent' ? String(req.body.subjectName || '').trim() : undefined,
          startTime: status === 'absent' ? String(req.body.startTime || '').trim() : undefined,
          endTime: status === 'absent' ? String(req.body.endTime || '').trim() : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.attendance.push(row);
      } else {
        row.status = status;
        if (status === 'absent') {
          row.subjectName = String(req.body.subjectName || row.subjectName || '').trim();
          row.startTime = String(req.body.startTime || row.startTime || '').trim();
          row.endTime = String(req.body.endTime || row.endTime || '').trim();
        } else {
          delete row.subjectName;
          delete row.startTime;
          delete row.endTime;
        }
        row.updatedAt = new Date().toISOString();
      }
      return row;
    });
    if (!record) return res.status(404).json({ error: 'Student not found.' });
    if (status === 'absent') {
      await smsQueue.enqueueAbsentWhatsAppAlerts({ date, studentIds: [studentId] });
    }
    res.json(record);
  }));

  router.post('/bulk', asyncHandler(async (req, res) => {
    const { date = todayISO(), entries = [] } = req.body;
    const saved = await store.update((data) => {
      const out = [];
      for (const entry of entries) {
        if (!['present', 'absent', 'late'].includes(entry.status)) continue;
        if (!data.students.some((student) => student.id === entry.studentId)) continue;
        let row = data.attendance.find((item) => item.studentId === entry.studentId && item.date === date);
        if (!row) {
          row = {
            id: newId('att'),
            studentId: entry.studentId,
            date,
            status: entry.status,
            subjectName: entry.status === 'absent' ? String(entry.subjectName || '').trim() : undefined,
            startTime: entry.status === 'absent' ? String(entry.startTime || '').trim() : undefined,
            endTime: entry.status === 'absent' ? String(entry.endTime || '').trim() : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          data.attendance.push(row);
        } else {
          row.status = entry.status;
          if (entry.status === 'absent') {
            row.subjectName = String(entry.subjectName || row.subjectName || '').trim();
            row.startTime = String(entry.startTime || row.startTime || '').trim();
            row.endTime = String(entry.endTime || row.endTime || '').trim();
          } else {
            delete row.subjectName;
            delete row.startTime;
            delete row.endTime;
          }
          row.updatedAt = new Date().toISOString();
        }
        out.push(row);
      }
      return out;
    });
    const absentIds = saved.filter((item) => item.status === 'absent').map((item) => item.studentId);
    if (absentIds.length) {
      await smsQueue.enqueueAbsentWhatsAppAlerts({ date, studentIds: absentIds });
    }
    res.json(saved);
  }));

  router.post('/queue-absent-alerts', asyncHandler(async (req, res) => {
    const queued = await smsQueue.enqueueAbsentAlerts(req.body);
    res.status(201).json({ queuedCount: queued.length, queued });
  }));

  router.post('/queue-absent-whatsapp-alerts', asyncHandler(async (req, res) => {
    const queued = await smsQueue.enqueueAbsentWhatsAppAlerts(req.body);
    res.status(201).json({ queuedCount: queued.length, queued });
  }));

  router.get('/summary', asyncHandler(async (req, res) => {
    const { date = todayISO(), className = '', year = '' } = req.query;
    const data = await store.read();
    const students = data.students.filter((student) => {
      const matchesClass = !className || student.className === className;
      const matchesYear = !year || student.year === year;
      return matchesClass && matchesYear;
    });
    const counts = { total: students.length, present: 0, absent: 0, late: 0, unmarked: 0 };
    for (const student of students) {
      const status = data.attendance.find((item) => item.studentId === student.id && item.date === date)?.status || 'present';
      counts[status] += 1;
    }
    res.json(counts);
  }));

  router.get('/trends', asyncHandler(async (req, res) => {
    const { className = '', year = '', days = 14 } = req.query;
    const data = await store.read();
    const dates = [...new Set(data.attendance.map((item) => item.date))].sort().slice(-Number(days));
    const points = dates.map((date) => {
      const studentIds = data.students
        .filter((student) => {
          const matchesClass = !className || student.className === className;
          const matchesYear = !year || student.year === year;
          return matchesClass && matchesYear;
        })
        .map((student) => student.id);
      const records = data.attendance.filter((item) => item.date === date && studentIds.includes(item.studentId));
      const total = studentIds.length || 1;
      const absentCount = records.filter((item) => item.status === 'absent').length;
      const lateCount = records.filter((item) => item.status === 'late').length;
      return {
        date,
        present: total - absentCount - lateCount,
        absent: absentCount,
        late: lateCount,
        attendancePercent: Math.round(((total - absentCount) / total) * 100)
      };
    });
    res.json(points);
  }));

  return router;
}
