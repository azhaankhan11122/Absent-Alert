export const todayISO = () => new Date().toISOString().slice(0, 10);

export function normalizePhone(value = '') {
  const parts = String(value).split(/[\/,;]/);
  return parts
    .map((p) => p.replace(/[^0-9+]/g, '').trim())
    .filter(Boolean)
    .join(' / ');
}

export function normalizeStudent(input = {}) {
  const rollNo = String(input.rollNo ?? input.roll ?? input['Roll No'] ?? input['roll_no'] ?? '').trim();
  const name = String(input.name ?? input['Name'] ?? input.studentName ?? '').trim();
  const className = String(input.className ?? input.class ?? input['Class'] ?? input.section ?? '').trim();
  const parentName = String(input.parentName ?? input['Parent Name'] ?? input.guardianName ?? '').trim();
  const parentPhone = normalizePhone(input.parentPhone ?? input.phone ?? input.mobile ?? input['Parent Phone'] ?? input['Mobile'] ?? '');
  const shariyathVal = String(input.shariyath ?? input.Shariyath ?? input.isShariyath ?? input['Is Shariyath'] ?? '').trim().toLowerCase();
  const shariyath = typeof input.shariyath === 'boolean' ? input.shariyath : ['true', 'yes', 'y', '1'].includes(shariyathVal);
  
  const yearRaw = String(input.year ?? input.Year ?? input.studentYear ?? '').trim().toLowerCase();
  let year = '1st';
  if (yearRaw.startsWith('1') || yearRaw.includes('first')) {
    year = '1st';
  } else if (yearRaw.startsWith('2') || yearRaw.includes('second')) {
    year = '2nd';
  } else if (['1st', '2nd'].includes(input.year)) {
    year = input.year;
  }
  
  return { rollNo, name, className, parentName, parentPhone, shariyath, year };
}

export function renderTemplate(template, student, record = {}, date = todayISO()) {
  return template
    .replaceAll('{name}', student.name || '')
    .replaceAll('{rollNo}', student.rollNo || '')
    .replaceAll('{className}', student.className || '')
    .replaceAll('{date}', date || todayISO())
    .replaceAll('{parentName}', student.parentName || '')
    .replaceAll('{subjectName}', record.subjectName || '')
    .replaceAll('{startTime}', record.startTime || '')
    .replaceAll('{endTime}', record.endTime || '')
    .replaceAll('[student_name]', student.name || '')
    .replaceAll('[roll_no]', student.rollNo || '')
    .replaceAll('[class_name]', student.className || '')
    .replaceAll('[date]', date || todayISO())
    .replaceAll('[parent_name]', student.parentName || '')
    .replaceAll('[subject_name]', record.subjectName || '')
    .replaceAll('[start_time]', record.startTime || '')
    .replaceAll('[end_time]', record.endTime || '');
}
