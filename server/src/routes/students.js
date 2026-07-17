import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { newId } from '../store.js';
import { normalizeStudent } from '../utils/normalize.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function studentsRouter(store) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    const { q = '', className = '' } = req.query;
    const data = await store.read();
    const needle = String(q).toLowerCase();
    const students = data.students.filter((student) => {
      const matchesSearch = !needle || [student.name, student.rollNo, student.parentName, student.parentPhone].some((value) => String(value || '').toLowerCase().includes(needle));
      const matchesClass = !className || student.className === className;
      return matchesSearch && matchesClass;
    }).sort((a, b) => `${a.className}${a.rollNo}`.localeCompare(`${b.className}${b.rollNo}`, undefined, { numeric: true }));
    res.json(students);
  });

  router.post('/', async (req, res) => {
    const student = normalizeStudent(req.body);
    if (!student.name || !student.rollNo || !student.className || !student.parentPhone) {
      return res.status(400).json({ error: 'name, rollNo, className, and parentPhone are required.' });
    }
    const created = await store.update((data) => {
      if (data.students.some((item) => item.rollNo === student.rollNo && item.className === student.className)) {
        throw Object.assign(new Error('Student roll number already exists in this class.'), { status: 409 });
      }
      const row = { id: newId('stu'), ...student, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.students.push(row);
      return row;
    });
    res.status(201).json(created);
  });

  router.put('/:id', async (req, res) => {
    const payload = normalizeStudent(req.body);
    const updated = await store.update((data) => {
      const student = data.students.find((item) => item.id === req.params.id);
      if (!student) return null;
      Object.assign(student, payload, { updatedAt: new Date().toISOString() });
      return student;
    });
    if (!updated) return res.status(404).json({ error: 'Student not found.' });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await store.update((data) => {
      const before = data.students.length;
      data.students = data.students.filter((item) => item.id !== req.params.id);
      data.attendance = data.attendance.filter((item) => item.studentId !== req.params.id);
      return before !== data.students.length;
    });
    res.status(deleted ? 204 : 404).send();
  });

  router.post('/import', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV or XLSX file is required.' });
    const lower = req.file.originalname.toLowerCase();
    let rows;
    if (lower.endsWith('.csv')) {
      rows = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
    } else if (lower.endsWith('.xlsx')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return res.status(400).json({ error: 'Workbook has no worksheets.' });
      const headers = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value || '').trim(); });
      rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const item = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const key = headers[colNumber];
          if (key) item[key] = cell.text || String(cell.value ?? '');
        });
        if (Object.values(item).some((value) => String(value).trim())) rows.push(item);
      });
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Upload .csv or .xlsx.' });
    }

    const result = await store.update((data) => {
      let created = 0;
      let updated = 0;
      const skipped = [];
      rows.forEach((row, index) => {
        const student = normalizeStudent(row);
        if (!student.name || !student.rollNo || !student.className || !student.parentPhone) {
          skipped.push({ row: index + 2, reason: 'Missing required fields', data: row });
          return;
        }
        const existing = data.students.find((item) => item.rollNo === student.rollNo && item.className === student.className);
        if (existing) {
          Object.assign(existing, student, { updatedAt: new Date().toISOString() });
          updated += 1;
        } else {
          data.students.push({ id: newId('stu'), ...student, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          created += 1;
        }
      });
      return { created, updated, skipped };
    });

    res.json(result);
  });

  return router;
}
