import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, RefreshCw, Search, Upload, Users } from 'lucide-react';
import { api } from './api/client';
import TrendChart from './components/TrendChart';
import './styles.css';

const emptyForm = { name: '', rollNo: '', className: '', parentName: '', parentPhone: '', shariyath: false };
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
  const [filters, setFilters] = useState({ q: '', className: '', date: today });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [view, setView] = useState('attendance');
  const [toast, setToast] = useState('');

  const loadAll = async () => {
    const [studentsData, classesData, attendanceData, summaryData, trendsData, queueData, gatewayData, whatsAppData] = await Promise.all([
      api.getStudents({ q: filters.q, className: filters.className }),
      api.getClasses(),
      api.getAttendance({ date: filters.date, className: filters.className }),
      api.getSummary({ date: filters.date, className: filters.className }),
      api.getTrends({ className: filters.className, days: 14 }),
      api.getSmsQueue(),
      api.getGatewayStatus(),
      api.getWhatsAppStatus()
    ]);
    setStudents(studentsData);
    setClasses(classesData);
    setAttendance(attendanceData);
    setSummary(summaryData);
    setTrends(trendsData);
    setQueue(queueData);
    setGateway(gatewayData);
    setWhatsApp(whatsAppData);
  };

  useEffect(() => { loadAll().catch((error) => setToast(error.message)); }, [filters.q, filters.className, filters.date]);
  useEffect(() => {
    const id = setInterval(() => {
      api.getSmsQueue().then(setQueue).catch(() => {});
      api.getGatewayStatus().then(setGateway).catch(() => {});
      api.getWhatsAppStatus().then(setWhatsApp).catch(() => {});
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

  async function saveStudent(event) {
    event.preventDefault();
    try {
      if (editingId) await api.updateStudent(editingId, form);
      else await api.createStudent(form);
      setForm(emptyForm); setEditingId(null); setToast('Student saved.'); await loadAll();
    } catch (error) { setToast(error.message); }
  }

  async function mark(studentId, status) {
    const payload = { studentId, status, date: filters.date };
    if (status === 'absent') {
      payload.subjectName = absentDetails.subjectName;
      payload.startTime = absentDetails.startTime;
      payload.endTime = absentDetails.endTime;
    }
    await api.markAttendance(payload);
    await loadAll();
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
    const result = await api.queueAbsentWhatsAppAlerts({ date: filters.date, className: filters.className });
    setToast(`${result.queuedCount} WhatsApp alert(s) queued.`);
    await loadAll();
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

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Wired SMS Gateway Attendance System</p>
          <h1>Absent Alert</h1>
          <p>Manage students, mark attendance, visualize trends, and send automatic SMS alerts through a USB-connected Android phone with a BSNL SIM.</p>
        </div>
        <div className={`gateway ${gateway.ok ? 'ok' : 'bad'}`}>
          {gateway.ok ? <CheckCircle2 /> : <AlertTriangle />}
          <div><b>{gateway.ok ? 'ADB phone connected' : 'SMS gateway offline'}</b><small>{gateway.selected?.serial || gateway.error || 'Connect phone and enable USB debugging'}</small></div>
        </div>
      </header>

      <section className="toolbar">
        <label className="search"><Search size={18} /><input placeholder="Search by name, roll no, parent, phone" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
        <select value={filters.className} onChange={(e) => setFilters({ ...filters, className: e.target.value })}><option value="">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</select>
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <button className={whatsApp.connected ? 'ghost' : ''} onClick={loginWhatsApp}>{whatsApp.connected ? 'WhatsApp connected' : 'Login with WhatsApp'}</button>
        <span className={`whatsapp-badge ${whatsApp.connected ? 'ok' : 'bad'}`}>{whatsApp.connected ? 'WhatsApp ready' : (whatsApp.configured ? 'Not connected' : 'Configure WhatsApp')}</span>
        <div className="segmented"><button className={view === 'attendance' ? 'active' : ''} onClick={() => setView('attendance')}>Attendance</button><button className={view === 'students' ? 'active' : ''} onClick={() => setView('students')}>Students</button><button className={view === 'sms' ? 'active' : ''} onClick={() => setView('sms')}>SMS Queue</button></div>
      </section>

      {toast && <div className="toast" onClick={() => setToast('')}>{toast}</div>}

      <section className="stats">
        <Stat label="Students" value={summary.total} icon={<Users />} />
        <Stat label="Present" value={summary.present} icon={<CheckCircle2 />} />
        <Stat label="Absent" value={summary.absent} icon={<AlertTriangle />} />
        <Stat label="Late" value={summary.late} icon={<Clock />} />
        <Stat label="Unmarked" value={summary.unmarked} icon={<RefreshCw />} />
      </section>

      <section className="panel">
        <div className="panel-title"><h2>Attendance Trend</h2><small>Last marked dates for selected class</small></div>
        <TrendChart points={trends} />
      </section>

      {view === 'attendance' && <section className="panel">
        <div className="panel-title"><h2>Class-wise Attendance</h2><button className="danger" onClick={queueAlerts}><MessageSquare size={16} /> Send absent WhatsApp alerts</button></div>
        <div className="attendance-config">
          <label>Subject name<input value={absentDetails.subjectName} onChange={(e) => setAbsentDetails({ ...absentDetails, subjectName: e.target.value })} placeholder="Math" /></label>
          <label>Start time<input type="time" value={absentDetails.startTime} onChange={(e) => setAbsentDetails({ ...absentDetails, startTime: e.target.value })} /></label>
          <label>End time<input type="time" value={absentDetails.endTime} onChange={(e) => setAbsentDetails({ ...absentDetails, endTime: e.target.value })} /></label>
          <p className="hint">When you mark a student absent, this info will be included in WhatsApp notifications.</p>
        </div>
        <div className="table">
          <div className="tr head"><span>Roll</span><span>Name</span><span>Class</span><span>Parent Phone</span><span>Status</span></div>
          {attendance.map(({ student, status }) => <div className="tr" key={student.id}>
            <span>{student.rollNo}</span><span>{student.name} {student.shariyath && <span style={{ color: '#d9383a', fontSize: '11px', fontWeight: 'bold', marginLeft: '4px' }}>(Shariyath)</span>}</span><span>{student.className}</span><span>{student.parentPhone}</span>
            <span className="actions">{['present', 'absent', 'late'].map((s) => <button key={s} className={status === s ? `active ${s}` : ''} onClick={() => mark(student.id, s)}>{s}</button>)}</span>
          </div>)}
        </div>
      </section>}

      {view === 'students' && <section className="grid2">
        <form className="panel form" onSubmit={saveStudent}>
          <div className="panel-title"><h2>{editingId ? 'Edit Student' : 'Add Student'}</h2><label className="upload"><Upload size={16} /> Import CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={importFile} hidden /></label></div>
          {Object.keys(emptyForm).filter((key) => key !== 'shariyath').map((key) => <input key={key} required={['name', 'rollNo', 'className', 'parentPhone'].includes(key)} placeholder={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />)}
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
          <div className="cards">{students.map((student) => <article className="card" key={student.id}><b>{student.name} {student.shariyath && <span style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '10px', backgroundColor: '#ffe9e9', color: '#d9383a', border: '1px solid #ffccd0', borderRadius: '6px' }}>Shariyath</span>}</b><small>{student.className} • Roll {student.rollNo}</small><small>{student.parentName || 'Parent'}: {student.parentPhone}</small><div><button onClick={() => { setEditingId(student.id); setForm({ ...emptyForm, ...student }); }}>Edit</button><button className="danger ghost" onClick={async () => { await api.deleteStudent(student.id); await loadAll(); }}>Delete</button></div></article>)}</div>
        </div>
      </section>}

      {view === 'sms' && <section className="panel">
        <div className="panel-title"><h2>SMS Queue Reliability Monitor</h2><small>Queued jobs are retried with exponential backoff when ADB/phone is unavailable.</small></div>
        <div className="table sms"><div className="tr head"><span>Status</span><span>Phone</span><span>Message</span><span>Attempts</span><span>Error</span></div>
          {queue.map((job) => <div className="tr" key={job.id}><span className={`badge ${job.status}`}>{job.status}</span><span>{job.phone}</span><span>{job.message}</span><span>{job.attempts}/{job.maxAttempts}</span><span>{job.lastError || job.sentAt || '-'} {job.status === 'failed' && <button onClick={async () => { await api.retrySms(job.id); await loadAll(); }}>Retry</button>}</span></div>)}
        </div>
      </section>}

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
  );
}

createRoot(document.getElementById('root')).render(<App />);
