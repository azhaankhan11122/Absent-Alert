import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, RefreshCw, Search, Upload, Users, Settings, UserPlus, Calendar, Moon, Sun } from 'lucide-react';
import { api } from './api/client';
import TrendChart from './components/TrendChart';
import StudentSearchTab from './components/StudentSearchTab';
import TimeTablesTab from './components/TimeTablesTab';
import TeachersTab from './components/TeachersTab';
import './styles.css';

const emptyForm = { name: '', rollNo: '', className: '', year: '1st', parentName: '', parentPhone: '', shariyath: false };
const today = new Date().toISOString().slice(0, 10);

function Stat({ label, value, icon }) {
  return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>;
}

function App() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, unmarked: 0 });
  const [trends, setTrends] = useState([]);
  const [queue, setQueue] = useState([]);
  const [gateway, setGateway] = useState({ ok: false, devices: [] });
  const [whatsApp, setWhatsApp] = useState({ connected: false, configured: false, phoneNumberId: '', qr: null });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [absentDetails, setAbsentDetails] = useState({ subjectName: '', startTime: '', endTime: '' });
  const [filters, setFilters] = useState({ q: '', className: '', date: today, year: '' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('attendance');
  const [toast, setToast] = useState('');

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Settings states
  const [schoolName, setSchoolName] = useState('');
  const [absentSmsTemplate, setAbsentSmsTemplate] = useState('');
  const [absentWhatsAppTemplate, setAbsentWhatsAppTemplate] = useState('');
  const [customStudentFields, setCustomStudentFields] = useState([]);

  // Timetable states
  const [timetable, setTimetable] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const emptyTimetableForm = { day: 'Monday', subjectName: '', startTime: '09:00', endTime: '10:00', className: '', year: '1st' };
  const [timetableForm, setTimetableForm] = useState(emptyTimetableForm);

  const [timetableSlots, setTimetableSlots] = useState(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']);

  const loadAll = async () => {
    const [studentsData, classesData, attendanceData, summaryData, trendsData, queueData, gatewayData, whatsAppData, settingsData, timetableData, teachersData] = await Promise.all([
      api.getStudents({ q: filters.q, className: filters.className, year: filters.year }),
      api.getClasses(),
      api.getAttendance({ date: filters.date, className: filters.className, year: filters.year }),
      api.getSummary({ date: filters.date, className: filters.className, year: filters.year }),
      api.getTrends({ className: filters.className, year: filters.year, days: 14 }),
      api.getSmsQueue(),
      api.getGatewayStatus(),
      api.getWhatsAppStatus(),
      api.getSettings().catch(() => ({})),
      api.getTimetable().catch(() => []),
      api.getTeachers().catch(() => [])
    ]);
    setStudents(studentsData);
    setClasses(classesData);
    setAttendance(attendanceData);
    setSummary(summaryData);
    setTrends(trendsData);
    setQueue(queueData);
    setGateway(gatewayData);
    setWhatsApp(whatsAppData);
    setTimetable(timetableData || []);
    setTeachers(teachersData || []);
    if (settingsData) {
      setSchoolName(settingsData.schoolName || '');
      setAbsentSmsTemplate(settingsData.absentSmsTemplate || '');
      setAbsentWhatsAppTemplate(settingsData.absentWhatsAppTemplate || '');
      setCustomStudentFields(settingsData.customStudentFields || []);
      setTimetableSlots(settingsData.timetableSlots || ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']);
    }
  };

  async function saveSettings(event) {
    event.preventDefault();
    try {
      const result = await api.updateSettings({ schoolName, absentSmsTemplate, absentWhatsAppTemplate, customStudentFields, timetableSlots });
      setSchoolName(result.schoolName || '');
      setAbsentSmsTemplate(result.absentSmsTemplate || '');
      setAbsentWhatsAppTemplate(result.absentWhatsAppTemplate || '');
      setCustomStudentFields(result.customStudentFields || []);
      setTimetableSlots(result.timetableSlots || ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']);
      setToast('Settings saved successfully.');
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveTimetableSlot(event) {
    event.preventDefault();
    try {
      await api.createTimetable(timetableForm);
      setTimetableForm(emptyTimetableForm);
      setToast('Timetable slot added successfully.');
      await loadAll();
    } catch (error) {
      setToast(error.message);
    }
  }

  async function deleteTimetableSlot(id) {
    if (!window.confirm('Are you sure you want to delete this timetable slot?')) return;
    try {
      await api.deleteTimetable(id);
      setToast('Timetable slot deleted.');
      await loadAll();
    } catch (error) {
      setToast(error.message);
    }
  }

  useEffect(() => { loadAll().catch((error) => setToast(error.message)); }, [filters.q, filters.className, filters.date, filters.year]);
  useEffect(() => {
    const id = setInterval(() => {
      api.getSmsQueue().then(setQueue).catch(() => { });
      api.getGatewayStatus().then(setGateway).catch(() => { });
      api.getWhatsAppStatus().then(setWhatsApp).catch(() => { });
      api.getTimetable().then(setTimetable).catch(() => { });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showLoginModal) return;
    const pollId = setInterval(async () => {
      try {
        const status = await api.getWhatsAppStatus();
        setWhatsApp(status);
        if (status.connected) {
          setShowLoginModal(false);
          setQrCodeUrl(null);
          setToast('WhatsApp connected successfully!');
        } else if (status.qr) {
          setQrCodeUrl(status.qr);
        }
      } catch (err) {
        console.error('Error polling WhatsApp status:', err);
      }
    }, 3000);
    return () => clearInterval(pollId);
  }, [showLoginModal]);

  const attendanceByStudent = useMemo(() => Object.fromEntries(attendance.map((row) => [row.student.id, row.status])), [attendance]);

  const todayDayName = useMemo(() => {
    if (!filters.date) return '';
    // Fix offset issue by creating date from string directly to avoid UTC shifts
    const [year, month, day] = filters.date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dateObj.getDay()];
  }, [filters.date]);

  const todayTimetableSlots = useMemo(() => {
    return timetable.filter((slot) => slot.day === todayDayName);
  }, [timetable, todayDayName]);

  async function saveStudent(event) {
    event.preventDefault();
    try {
      if (editingId) await api.updateStudent(editingId, form);
      else await api.createStudent(form);
      setForm(emptyForm); setEditingId(null); setToast('Student saved.'); await loadAll();
    } catch (error) { setToast(error.message); }
  }

  async function mark(studentId, status) {
    try {
      const payload = { studentId, status, date: filters.date };
      if (status === 'absent') {
        payload.subjectName = absentDetails.subjectName;
        payload.startTime = absentDetails.startTime;
        payload.endTime = absentDetails.endTime;
      }
      await api.markAttendance(payload);
      await loadAll();
    } catch (error) {
      setToast(error.message);
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await api.importStudents(formData);
      setToast(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped.length} skipped.`);
      await loadAll();
    } catch (error) { setToast(error.message); }
    event.target.value = '';
  }

  async function queueAlerts() {
    try {
      const result = await api.queueAbsentWhatsAppAlerts({ date: filters.date, className: filters.className, year: filters.year });
      setToast(`${result.queuedCount} WhatsApp alert(s) queued.`);
      await loadAll();
    } catch (error) {
      setToast(error.message);
    }
  }

  async function loginWhatsApp() {
    try {
      const result = await api.loginWithWhatsApp();
      setWhatsApp(result);
      if (result.qr) {
        setQrCodeUrl(result.qr);
        setShowLoginModal(true);
      } else if (result.connected) {
        setToast('WhatsApp connected successfully.');
      } else {
        setToast('WhatsApp login request received.');
      }
    } catch (error) {
      setToast(error.message);
    }
  }

  async function logoutWhatsApp() {
    if (!window.confirm('Are you sure you want to log out from WhatsApp?')) {
      return;
    }
    try {
      const result = await api.logoutWhatsApp();
      setWhatsApp(result);
      setToast('WhatsApp logged out successfully.');
    } catch (error) {
      setToast('Logout failed: ' + error.message);
    }
  }

  async function approveAlert(id) {
    try {
      await api.approveSms(id);
      setToast('Alert approved and queued for sending.');
      await loadAll();
    } catch (error) {
      setToast('Approval failed: ' + error.message);
    }
  }

  async function approveAllAlerts() {
    if (!window.confirm('Are you sure you want to approve and send all pending alerts?')) {
      return;
    }
    try {
      const result = await api.approveAllSms();
      setToast(`${result.approvedCount} alert(s) approved and queued.`);
      await loadAll();
    } catch (error) {
      setToast('Bulk approval failed: ' + error.message);
    }
  }

  async function deleteAlert(id) {
    if (!window.confirm('Are you sure you want to dismiss/delete this alert?')) {
      return;
    }
    try {
      await api.deleteSms(id);
      setToast('Alert dismissed successfully.');
      await loadAll();
    } catch (error) {
      setToast('Dismissal failed: ' + error.message);
    }
  }

  async function clearAllData() {
    if (!window.confirm('Are you sure you want to delete all students, attendance records, and SMS queue history? This action cannot be undone.')) {
      return;
    }
    try {
      await api.clearAllData();
      setToast('Database cleared successfully.');
      await loadAll();
    } catch (error) {
      setToast(error.message);
    }
  }

  const handleThemeToggle = () => {
    document.body.classList.add('theme-toggling');
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setTimeout(() => {
      document.body.classList.remove('theme-toggling');
    }, 400); // Matches CSS transition duration
  };

  return (
    <>
    <div className="background-mesh"></div>
    <main>
      <header className="hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <img src="/logo.svg" alt="Absent Alert Logo" style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'contain', background: 'rgba(255,255,255,0.1)', padding: '4px', zIndex: 1 }} />
          <div style={{ zIndex: 1 }}>
            <p className="eyebrow">Wired SMS Gateway Attendance System</p>
            <h1>Absent Alert</h1>
            <p>Manage students, mark attendance, visualize trends, and send automatic alerts on WhatsApp.</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-end', zIndex: 1 }}>
          <button className="ghost" onClick={handleThemeToggle} style={{ borderRadius: '50%', padding: '12px' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={`gateway ${gateway.ok ? 'ok' : 'bad'}`}>
            {gateway.ok ? <CheckCircle2 /> : <AlertTriangle />}
            <div><b>{gateway.ok ? 'ADB phone connected' : 'SMS gateway offline'}</b><small>{gateway.selected?.serial || gateway.error || 'Connect phone and enable USB debugging'}</small></div>
          </div>
        </div>
      </header>

      <section className="toolbar">
        <label className="search"><Search size={18} /><input placeholder="Search by name, roll no, parent, phone" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
        <select value={filters.className} onChange={(e) => setFilters({ ...filters, className: e.target.value })}><option value="">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
          <option value="">All years</option>
          <option value="1st">1st Year</option>
          <option value="2nd">2nd Year</option>
        </select>
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        {whatsApp.connected ? (
          <>
            <button className="ghost" onClick={loginWhatsApp}>WhatsApp connected</button>
            <button className="danger" onClick={logoutWhatsApp}>Logout WhatsApp</button>
          </>
        ) : (
          <button onClick={loginWhatsApp}>Login with WhatsApp</button>
        )}
        <span className={`whatsapp-badge ${whatsApp.connected ? 'ok' : 'bad'}`}>{whatsApp.connected ? 'WhatsApp ready' : (whatsApp.configured ? 'Not connected' : 'Configure WhatsApp')}</span>
        <div className="segmented">
          <button className={view === 'attendance' ? 'active' : ''} onClick={() => setView('attendance')}>Attendance</button>
          <button className={view === 'students' ? 'active' : ''} onClick={() => setView('students')}>Students</button>
          <button className={view === 'student-search' ? 'active' : ''} onClick={() => setView('student-search')}>Search</button>
          <button className={view === 'timetables' ? 'active' : ''} onClick={() => setView('timetables')}>Time Tables</button>
          <button className={view === 'teachers' ? 'active' : ''} onClick={() => setView('teachers')}>Teachers</button>
          <button className={view === 'sms' ? 'active' : ''} onClick={() => setView('sms')}>SMS Queue</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Settings size={14} /> Settings</button>
        </div>
      </section>

      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}

      <section className="stats">
        <Stat label="Students" value={summary.total} icon={<Users />} />
        <Stat label="Present" value={summary.present} icon={<CheckCircle2 />} />
        <Stat label="Absent" value={summary.absent} icon={<AlertTriangle />} />
        <Stat label="Late" value={summary.late} icon={<Clock />} />
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Attendance Trend</h2><small>Last marked dates for selected class</small></div>
        <TrendChart points={trends} />
      </section>

      {view === 'attendance' && <section className="panel">
        <div className="panel-title"><h2>Class-wise Attendance</h2><button className="danger" onClick={queueAlerts}><MessageSquare size={16} /> Send absent WhatsApp alerts</button></div>

        {todayTimetableSlots.length > 0 ? (
          <div className="timetable-bar" style={{ padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '0 0 16px' }}>
            <strong style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '8px' }}>Today's Timetable ({todayDayName}) - Click a class to pre-fill</strong>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {todayTimetableSlots.map((slot) => {
                const isActive = filters.className === slot.className && filters.year === slot.year && absentDetails.subjectName === slot.subjectName && absentDetails.startTime === slot.startTime && absentDetails.endTime === slot.endTime;
                return (
                  <button
                    key={slot.id}
                    onClick={() => {
                      setFilters({ ...filters, className: slot.className, year: slot.year });
                      setAbsentDetails({ subjectName: slot.subjectName, startTime: slot.startTime, endTime: slot.endTime });
                      setToast(`Selected ${slot.subjectName} for ${slot.className} (${slot.year} Year)`);
                    }}
                    style={{
                      padding: '8px 12px',
                      background: isActive ? '#3b82f6' : 'white',
                      color: isActive ? 'white' : '#1e293b',
                      border: '1px solid ' + (isActive ? '#2563eb' : '#cbd5e1'),
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '500',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      textAlign: 'left'
                    }}
                  >
                    <strong>{slot.subjectName}</strong>
                    <span style={{ fontSize: '11px', opacity: 0.9 }}>{slot.className} ({slot.year} Year)</span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{slot.startTime} - {slot.endTime}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="timetable-bar" style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px dashed var(--border)', margin: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-hint)' }}>No classes scheduled for today ({todayDayName || 'None'}). Configure them under the <strong>Settings</strong> tab.</span>
          </div>
        )}

        <div className="attendance-config">
          <label>Subject name<input value={absentDetails.subjectName} onChange={(e) => setAbsentDetails({ ...absentDetails, subjectName: e.target.value })} placeholder="Math" /></label>
          <label>Start time<input type="time" value={absentDetails.startTime} onChange={(e) => setAbsentDetails({ ...absentDetails, startTime: e.target.value })} /></label>
          <label>End time<input type="time" value={absentDetails.endTime} onChange={(e) => setAbsentDetails({ ...absentDetails, endTime: e.target.value })} /></label>
          <p className="hint">When you mark a student absent, this info will be included in WhatsApp notifications.</p>
        </div>
        <div className="table">
          <div className="tr head"><span>Roll</span><span>Name</span><span>Class/Year</span><span>Parent Phone</span><span>Status</span></div>
          {attendance.map(({ student, status }) => <div className="tr" key={student.id}>
            <span>{student.rollNo}</span><span>{student.name} {student.shariyath && <span style={{ color: '#d9383a', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>(Shariyath)</span>}</span><span>{student.className} ({student.year})</span><span>{student.parentPhone}</span>
            <span className="actions">{['present', 'absent', 'late'].map((s) => <button key={s} className={status === s ? `active ${s}` : ''} onClick={() => mark(student.id, s)}>{s}</button>)}</span>
          </div>)}
        </div>
      </section>}

      {view === 'students' && <section className="grid2">
        <form className="panel form" onSubmit={saveStudent}>
          <div className="panel-title"><h2>{editingId ? 'Edit Student' : 'Add Student'}</h2><label className="upload"><Upload size={16} /> Import CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={importFile} hidden /></label></div>
          {Object.keys(emptyForm).filter((key) => key !== 'shariyath' && key !== 'year').map((key) => <input key={key} required={['name', 'rollNo', 'className', 'parentPhone'].includes(key)} placeholder={key} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}

          {customStudentFields.map(field => (
            <input
              key={field.name}
              placeholder={field.name}
              value={form[field.name] || ''}
              onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
            />
          ))}

          <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
            <option value="1st">1st Year</option>
            <option value="2nd">2nd Year</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '4px 0 8px' }}>
            <input type="checkbox" checked={Boolean(form.shariyath)} onChange={(e) => setForm({ ...form, shariyath: e.target.checked })} />
            <span style={{ fontSize: '14px', color: '#405172', fontWeight: '500' }}>Shariyath student (exclude from alerts)</span>
          </label>
          <button type="submit">{editingId ? 'Update student' : 'Add student'}</button>
        </form>
        <div className="panel">
          <div className="panel-title">
            <h2>Students</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <small>{students.length} result(s)</small>
              {students.length > 0 && (
                <button className="danger ghost" onClick={clearAllData} style={{ padding: '4px 8px', fontSize: '12px' }}>
                  Clear Database
                </button>
              )}
            </div>
          </div>
          <div className="cards">{students.map((student) => <article className="card" key={student.id}><b>{student.name} {student.shariyath && <span style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '10px', backgroundColor: '#ffe9e9', color: '#d9383a', border: '1px solid #ffccd0', borderRadius: '6px' }}>Shariyath</span>}</b><small>{student.className} • {student.year} Year • Roll {student.rollNo}</small><small>{student.parentName || 'Parent'}: {student.parentPhone}</small><div><button onClick={() => { setEditingId(student.id); setForm({ ...emptyForm, ...student }); }}>Edit</button><button className="danger ghost" onClick={async () => { await api.deleteStudent(student.id); await loadAll(); }}>Delete</button></div></article>)}</div>
        </div>
      </section>}

      {view === 'sms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pending Verification Section */}
          <section className="panel" style={{ margin: 0 }}>
            <div className="panel-title">
              <h2>Pending Verification ({queue.filter(j => j.status === 'pending').length})</h2>
              {queue.some(j => j.status === 'pending') && (
                <button onClick={approveAllAlerts}>Approve & Send All</button>
              )}
            </div>
            <p className="hint" style={{ marginBottom: '16px' }}>Review the alerts below. Click Approve to send or Dismiss to cancel.</p>

            {queue.filter(j => j.status === 'pending').length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                No alerts pending verification.
              </div>
            ) : (
              <div className="table sms">
                <div className="tr head">
                  <span>Student</span>
                  <span>Phone</span>
                  <span>Message</span>
                  <span>Provider</span>
                  <span>Actions</span>
                </div>
                {queue.filter(j => j.status === 'pending').map((job) => {
                  const student = students.find(s => s.id === job.studentId);
                  return (
                    <div className="tr" key={job.id}>
                      <span>
                        <b>{student?.name || 'Unknown Student'}</b>
                        <small>{student?.className} ({student?.year} Year)</small>
                      </span>
                      <span>{job.phone}</span>
                      <span style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{job.message}</span>
                      <span className="badge" style={{ backgroundColor: job.provider === 'whatsapp' ? '#def7ed' : '#edf3fc', color: job.provider === 'whatsapp' ? '#0f5c36' : '#405172' }}>
                        {job.provider}
                      </span>
                      <div className="actions" style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => approveAlert(job.id)} style={{ backgroundColor: '#1e9e58', color: 'white', padding: '6px 10px', fontSize: '12px' }}>Approve</button>
                        <button className="danger ghost" onClick={() => deleteAlert(job.id)} style={{ padding: '6px 10px', fontSize: '12px' }}>Dismiss</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Activity Queue Section */}
          <section className="panel" style={{ margin: 0 }}>
            <div className="panel-title">
              <h2>SMS & WhatsApp Queue Reliability Monitor</h2>
              <small>Queued jobs are retried with exponential backoff when provider/device is busy.</small>
            </div>

            {queue.filter(j => j.status !== 'pending').length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                No active or historical alert jobs in queue.
              </div>
            ) : (
              <div className="table sms">
                <div className="tr head">
                  <span>Status</span>
                  <span>Student / Phone</span>
                  <span>Message</span>
                  <span>Attempts</span>
                  <span>Details</span>
                </div>
                {queue.filter(j => j.status !== 'pending').map((job) => {
                  const student = students.find(s => s.id === job.studentId);
                  return (
                    <div className="tr" key={job.id}>
                      <span className={`badge ${job.status}`}>{job.status}</span>
                      <span>
                        <b>{student?.name || 'Unknown'}</b>
                        <small>{job.phone}</small>
                        <small style={{ fontSize: '10px', textTransform: 'uppercase', display: 'inline-block', marginTop: '4px' }} className="badge">
                          {job.provider}
                        </small>
                      </span>
                      <span style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>{job.message}</span>
                      <span>{job.attempts}/{job.maxAttempts}</span>
                      <span>
                        {job.lastError || job.sentAt || '-'}
                        {job.status === 'failed' && (
                          <button onClick={async () => { await api.retrySms(job.id); await loadAll(); }} style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '11px' }}>Retry</button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {view === 'student-search' && (
        <StudentSearchTab
          students={students}
          attendance={attendance}
          customStudentFields={customStudentFields}
        />
      )}

      {view === 'timetables' && (
        <TimeTablesTab
          classes={classes}
          timetable={timetable}
          teachers={teachers}
          timetableSlots={timetableSlots}
          onUpdate={loadAll}
        />
      )}

      {view === 'teachers' && (
        <TeachersTab
          teachers={teachers}
          onUpdate={loadAll}
        />
      )}

      {view === 'settings' && <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <section className="panel" style={{ margin: 0 }}>
          <div className="panel-title"><h2>Customise Message Templates</h2></div>
          <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong>School / College Name</strong>
              <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Badria PU College" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong>WhatsApp Message Template</strong>
              <textarea
                value={absentWhatsAppTemplate}
                onChange={(e) => setAbsentWhatsAppTemplate(e.target.value)}
                placeholder="Dear Parent, [student_name], was absent on [date] ([start_time] to [end_time]) for [subject_name] Principal - Badria PU College"
                required
                rows={4}
                style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <small style={{ color: '#64748b' }}>
                Available placeholders: <code>[student_name]</code>, <code>[roll_no]</code>, <code>[class_name]</code>, <code>[date]</code>, <code>[subject_name]</code>, <code>[start_time]</code>, <code>[end_time]</code>
              </small>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <strong>SMS Message Template</strong>
              <textarea
                value={absentSmsTemplate}
                onChange={(e) => setAbsentSmsTemplate(e.target.value)}
                placeholder="Dear parent, [student_name] ([roll_no]) from class [class_name] is absent on [date]."
                required
                rows={3}
                style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
              <small style={{ color: '#64748b' }}>
                Available placeholders: same as WhatsApp templates.
              </small>
            </label>

            <button type="submit" style={{ alignSelf: 'flex-start', padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Save Settings</button>
          </form>
        </section>

        <section className="panel" style={{ margin: 0 }}>
          <div className="panel-title">
            <h2>Custom Student Fields</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 16px' }}>Define extra information you want to store for each student (e.g. Address, Date of Birth).</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customStudentFields.map((field, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={field.name}
                  onChange={(e) => {
                    const newFields = [...customStudentFields];
                    newFields[index].name = e.target.value;
                    setCustomStudentFields(newFields);
                  }}
                  placeholder="Field Name"
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', flex: 1 }}
                />
                <button
                  className="danger ghost"
                  onClick={() => {
                    const newFields = [...customStudentFields];
                    newFields.splice(index, 1);
                    setCustomStudentFields(newFields);
                  }}
                  style={{ padding: '8px 12px' }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="ghost"
                onClick={() => setCustomStudentFields([...customStudentFields, { name: '' }])}
              >
                + Add Field
              </button>
              <button
                onClick={(e) => saveSettings(e)}
                style={{ background: '#3b82f6', color: 'white' }}
              >
                Save Fields
              </button>
            </div>
          </div>
        </section>

        <section className="panel" style={{ margin: 0 }}>
          <div className="panel-title">
            <h2>Timetable Time Slots</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 16px' }}>Define the daily time slots used in your timetables.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {timetableSlots.map((slot, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="time"
                  value={slot}
                  onChange={(e) => {
                    const newSlots = [...timetableSlots];
                    newSlots[index] = e.target.value;
                    // Sort them chronologically
                    newSlots.sort();
                    setTimetableSlots(newSlots);
                  }}
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '150px' }}
                />
                <button
                  className="danger ghost"
                  onClick={() => {
                    const newSlots = [...timetableSlots];
                    newSlots.splice(index, 1);
                    setTimetableSlots(newSlots);
                  }}
                  style={{ padding: '8px 12px' }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                className="ghost"
                onClick={() => setTimetableSlots([...timetableSlots, '08:00'].sort())}
              >
                + Add Time Slot
              </button>
              <button
                onClick={(e) => saveSettings(e)}
                style={{ background: '#3b82f6', color: 'white' }}
              >
                Save Slots
              </button>
            </div>
          </div>
        </section>

        <section className="panel" style={{ margin: 0 }}>
          <div className="panel-title">
            <h2>Weekly Timetable Manager</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 16px' }}>Configure your weekly schedule. Today's classes will automatically appear on the main Attendance view for easy pre-filling.</p>

          <div className="grid2" style={{ gap: '24px', alignItems: 'start' }}>
            <form onSubmit={saveTimetableSlot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3>Add Class to Schedule</h3>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Day of the Week</span>
                <select value={timetableForm.day} onChange={(e) => setTimetableForm({ ...timetableForm, day: e.target.value })} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>

              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Class Name</span>
                  <input placeholder="e.g. 1st BBA" value={timetableForm.className} onChange={(e) => setTimetableForm({ ...timetableForm, className: e.target.value })} required style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }} />
                </label>

                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Year</span>
                  <select value={timetableForm.year} onChange={(e) => setTimetableForm({ ...timetableForm, year: e.target.value })} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }}>
                    <option value="1st">1st Year</option>
                    <option value="2nd">2nd Year</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Subject Name</span>
                <input placeholder="e.g. Science" value={timetableForm.subjectName} onChange={(e) => setTimetableForm({ ...timetableForm, subjectName: e.target.value })} required style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }} />
              </label>

              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Start Time</span>
                  <input type="time" value={timetableForm.startTime} onChange={(e) => setTimetableForm({ ...timetableForm, startTime: e.target.value })} required style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }} />
                </label>

                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>End Time</span>
                  <input type="time" value={timetableForm.endTime} onChange={(e) => setTimetableForm({ ...timetableForm, endTime: e.target.value })} required style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%' }} />
                </label>
              </div>

              <button type="submit" style={{ marginTop: '8px', padding: '10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Add Scheduled Class</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '0' }}>
              <h3>Current Weekly Schedule</h3>
              {timetable.length === 0 ? (
                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                  No classes scheduled yet.
                </div>
              ) : (
                <div className="table" style={{ fontSize: '13px', background: 'white' }}>
                  <div className="tr head"><span>Day</span><span>Subject</span><span>Class (Year)</span><span>Time</span><span>Action</span></div>
                  {timetable.map((slot) => (
                    <div className="tr" key={slot.id} style={{ display: 'flex', alignItems: 'center' }}>
                      <span><strong>{slot.day}</strong></span>
                      <span>{slot.subjectName}</span>
                      <span>{slot.className} ({slot.year})</span>
                      <span>{slot.startTime} - {slot.endTime}</span>
                      <span><button className="danger ghost" onClick={() => deleteTimetableSlot(slot.id)} style={{ padding: '4px 8px', fontSize: '11px' }}>Remove</button></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>}

      {showLoginModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Link WhatsApp</h3>
            <p>Scan this QR code using WhatsApp on your phone (Linked Devices &gt; Link a Device) to link this session.</p>

            <div className="qr-container">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="WhatsApp QR Code" className="qr-image" />
              ) : (
                <div className="qr-loading">
                  <div className="qr-spinner"></div>
                  <span>Generating QR Code...</span>
                </div>
              )}
            </div>

            <button className="modal-close-btn" onClick={() => { setShowLoginModal(false); setQrCodeUrl(null); }}>
              Close
            </button>
          </div>
        </div>
      )}
    </main>
    </>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
