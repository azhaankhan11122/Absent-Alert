import express from 'express';
import { newId } from '../store.js';

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function teachersRouter(store) {
  const router = express.Router();

  router.get('/', asyncHandler(async (req, res) => {
    const data = await store.read();
    res.json(data.teachers || []);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { name, subject } = req.body;
    if (!name || !subject) {
      return res.status(400).json({ error: 'name and subject are required.' });
    }
    
    const created = await store.update((data) => {
      const row = { id: newId('tch'), name, subject, createdAt: new Date().toISOString() };
      data.teachers = data.teachers || [];
      data.teachers.push(row);
      return row;
    });
    res.status(201).json(created);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const { name, subject } = req.body;
    const updated = await store.update((data) => {
      const teacher = (data.teachers || []).find((item) => item.id === req.params.id);
      if (!teacher) return null;
      if (name) teacher.name = name;
      if (subject) teacher.subject = subject;
      return teacher;
    });
    if (!updated) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(updated);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const deleted = await store.update((data) => {
      const before = (data.teachers || []).length;
      data.teachers = (data.teachers || []).filter((item) => item.id !== req.params.id);
      data.teacherAttendance = (data.teacherAttendance || []).filter((item) => item.teacherId !== req.params.id);
      return before !== data.teachers.length;
    });
    res.status(deleted ? 204 : 404).send();
  }));

  return router;
}
