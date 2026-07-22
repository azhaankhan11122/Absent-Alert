const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  getStudents: (params = {}) => request(`/students?${new URLSearchParams(params)}`),
  createStudent: (payload) => request('/students', { method: 'POST', body: JSON.stringify(payload) }),
  updateStudent: (id, payload) => request(`/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: 'DELETE' }),
  importStudents: (formData) => request('/students/import', { method: 'POST', body: formData }),
  getAttendance: (params = {}) => request(`/attendance?${new URLSearchParams(params)}`),
  markAttendance: (payload) => request('/attendance/mark', { method: 'POST', body: JSON.stringify(payload) }),
  getSummary: (params = {}) => request(`/attendance/summary?${new URLSearchParams(params)}`),
  getTrends: (params = {}) => request(`/attendance/trends?${new URLSearchParams(params)}`),
  queueAbsentAlerts: (payload) => request('/attendance/queue-absent-alerts', { method: 'POST', body: JSON.stringify(payload) }),
  getClasses: () => request('/classes'),
  getGatewayStatus: () => request('/gateway/status'),
  getWhatsAppStatus: () => request('/whatsapp/status'),
  loginWithWhatsApp: () => request('/whatsapp/login', { method: 'POST' }),
  queueAbsentWhatsAppAlerts: (payload) => request('/attendance/queue-absent-whatsapp-alerts', { method: 'POST', body: JSON.stringify(payload) }),
  getSmsQueue: () => request('/sms-queue'),
  retrySms: (id) => request(`/sms-queue/${id}/retry`, { method: 'POST' }),
  clearAllData: () => request('/students/clear', { method: 'POST' }),
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) })
};
