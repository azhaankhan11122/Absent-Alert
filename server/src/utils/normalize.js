export const todayISO = () => new Date().toISOString().slice(0, 10);

export function normalizePhone(value = '') {
  return String(value).replace(/[^0-9+]/g, '').trim();
}

export function normalizeStudent(input = {}) {
  const rollNo = String(input.rollNo ?? input.roll ?? input['Roll No'] ?? input['roll_no'] ?? '').trim();
  const name = String(input.name ?? input['Name'] ?? input.studentName ?? '').trim();
  const className = String(input.className ?? input.class ?? input['Class'] ?? input.section ?? '').trim();
  const parentName = String(input.parentName ?? input['Parent Name'] ?? input.guardianName ?? '').trim();
  const parentPhone = normalizePhone(input.parentPhone ?? input.phone ?? input.mobile ?? input['Parent Phone'] ?? input['Mobile'] ?? '');
  return { rollNo, name, className, parentName, parentPhone };
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
    .replaceAll('{endTime}', record.endTime || '');
}
