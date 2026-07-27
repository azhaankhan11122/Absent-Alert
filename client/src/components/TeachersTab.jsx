import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function TeachersTab({ teachers, onUpdate }) {
  const [stats, setStats] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyAttendance, setDailyAttendance] = useState([]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', subject: '' });
  
  useEffect(() => {
    loadData();
  }, [teachers, selectedDate]);

  const loadData = async () => {
    try {
      const [statsData, dailyData] = await Promise.all([
        api.getTeacherStats(),
        api.getTeacherAttendance({ date: selectedDate })
      ]);
      setStats(statsData);
      setDailyAttendance(dailyData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMark = async (teacherId, status) => {
    try {
      await api.markTeacherAttendance({
        teacherId,
        status,
        date: selectedDate
      });
      await loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const saveTeacher = async (e) => {
    e.preventDefault();
    try {
      await api.createTeacher(form);
      setForm({ name: '', subject: '' });
      setShowAddForm(false);
      onUpdate();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteTeacher = async (id) => {
    if (confirm('Are you sure you want to delete this teacher?')) {
      await api.deleteTeacher(id);
      onUpdate();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section className="panel" style={{ margin: 0 }}>
        <div className="panel-title">
          <h2>Daily Teacher Attendance</h2>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
          />
        </div>
        
        <div className="table">
          <div className="tr head">
            <span>Name</span>
            <span>Subject</span>
            <span>Status Today</span>
            <span>Actions</span>
          </div>
          {teachers.map((teacher) => {
            const record = dailyAttendance.find(a => a.teacherId === teacher.id);
            const status = record ? record.status : 'unmarked';
            
            return (
              <div className="tr" key={teacher.id}>
                <span><strong>{teacher.name}</strong></span>
                <span>{teacher.subject}</span>
                <span>
                  <span className={`badge ${status}`} style={{
                    backgroundColor: status === 'present' ? 'rgba(34, 197, 94, 0.2)' : status === 'absent' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-ghost)',
                    color: status === 'present' ? 'var(--success-color)' : status === 'absent' ? 'var(--danger-color)' : 'var(--text-hint)'
                  }}>
                    {status}
                  </span>
                </span>
                <span className="actions">
                  {['present', 'absent'].map(s => (
                    <button 
                      key={s} 
                      className={status === s ? `active ${s}` : ''} 
                      onClick={() => handleMark(teacher.id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
          {teachers.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-hint)' }}>No teachers added yet.</div>
          )}
        </div>
      </section>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <section className="panel" style={{ flex: '2', margin: 0 }}>
          <div className="panel-title">
            <h2>Teacher Statistics</h2>
          </div>
          <div className="table">
            <div className="tr head">
              <span>Teacher</span>
              <span>Last Class</span>
              <span>This Week</span>
              <span>This Month</span>
            </div>
            {stats.map(({ teacher, lastClass, weekPercentage, monthPercentage }) => (
              <div className="tr" key={teacher.id}>
                <span><strong>{teacher.name}</strong><br/><small>{teacher.subject}</small></span>
                <span>
                  {lastClass ? (
                    <span className={`badge ${lastClass}`}>{lastClass}</span>
                  ) : (
                    <span style={{ color: 'var(--text-hint)', fontSize: '12px' }}>N/A</span>
                  )}
                </span>
                <span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${weekPercentage}%`, height: '100%', background: weekPercentage > 80 ? '#22c55e' : weekPercentage > 50 ? '#eab308' : '#ef4444' }}></div>
                    </div>
                    <small>{weekPercentage}%</small>
                  </div>
                </span>
                <span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${monthPercentage}%`, height: '100%', background: monthPercentage > 80 ? '#22c55e' : monthPercentage > 50 ? '#eab308' : '#ef4444' }}></div>
                    </div>
                    <small>{monthPercentage}%</small>
                  </div>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" style={{ flex: '1', margin: 0 }}>
          <div className="panel-title">
            <h2>Manage Teachers</h2>
            <button onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Cancel' : 'Add Teacher'}
            </button>
          </div>
          
          {showAddForm && (
            <form onSubmit={saveTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', padding: '16px', background: 'var(--bg-panel)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <input 
                placeholder="Teacher Name" 
                value={form.name} 
                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                required 
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
              <input 
                placeholder="Subject (e.g. Mathematics)" 
                value={form.subject} 
                onChange={(e) => setForm({ ...form, subject: e.target.value })} 
                required 
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border)' }}
              />
              <button type="submit" style={{ background: 'var(--accent-primary)', color: 'white' }}>Save Teacher</button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teachers.map(teacher => (
              <div key={teacher.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <strong>{teacher.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-hint)' }}>{teacher.subject}</div>
                </div>
                <button className="danger ghost" onClick={() => deleteTeacher(teacher.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
