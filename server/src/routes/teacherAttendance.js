import express from 'express';
import { newId } from '../store.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function teacherAttendanceRouter(store) {
  const router = express.Router();

  // Get attendance records for teachers on a specific date
  router.get('/', asyncHandler(async (req, res) => {
    const { date } = req.query;
    const data = await store.read();
    
    let records = data.teacherAttendance || [];
    if (date) {
      records = records.filter(a => a.date === date);
    }
    
    // Join with teacher details
    const result = records.map(record => {
      const teacher = (data.teachers || []).find(t => t.id === record.teacherId) || { name: 'Unknown', subject: 'Unknown' };
      return { ...record, teacher };
    });
    
    res.json(result);
  }));
  
  // Get aggregated stats for teachers
  router.get('/stats', asyncHandler(async (req, res) => {
    const data = await store.read();
    const teachers = data.teachers || [];
    const attendance = data.teacherAttendance || [];
    
    // Group records by teacherId
    const teacherRecords = {};
    for (const record of attendance) {
      if (!teacherRecords[record.teacherId]) {
        teacherRecords[record.teacherId] = [];
      }
      teacherRecords[record.teacherId].push(record);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    const stats = teachers.map(teacher => {
      const records = teacherRecords[teacher.id] || [];
      records.sort((a, b) => b.date.localeCompare(a.date)); // Descending order
      
      const lastClass = records.length > 0 ? records[0].status : null;
      
      const calcPercent = (recs) => {
        if (recs.length === 0) return 0;
        const presents = recs.filter(r => r.status === 'present').length;
        return Math.round((presents / recs.length) * 100);
      };
      
      const weekRecords = records.filter(r => new Date(r.date) >= weekAgo);
      const monthRecords = records.filter(r => new Date(r.date) >= monthAgo);
      
      return {
        teacher,
        lastClass,
        weekPercentage: calcPercent(weekRecords),
        monthPercentage: calcPercent(monthRecords),
        overallPercentage: calcPercent(records)
      };
    });
    
    res.json(stats);
  }));

  // Mark attendance for a teacher
  router.post('/mark', asyncHandler(async (req, res) => {
    const { teacherId, status, date } = req.body;
    
    if (!teacherId || !status || !date) {
      return res.status(400).json({ error: 'teacherId, status, and date are required.' });
    }
    
    const updated = await store.update((data) => {
      data.teacherAttendance = data.teacherAttendance || [];
      const index = data.teacherAttendance.findIndex(a => a.teacherId === teacherId && a.date === date);
      
      let record;
      if (index >= 0) {
        data.teacherAttendance[index].status = status;
        data.teacherAttendance[index].updatedAt = new Date().toISOString();
        record = data.teacherAttendance[index];
      } else {
        record = {
          id: newId('att_tch'),
          teacherId,
          status,
          date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        data.teacherAttendance.push(record);
      }
      return record;
    });
    
    res.json(updated);
  }));

  return router;
}
