import React, { useState, useMemo } from 'react';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentSearchTab({ students, attendance, customStudentFields }) {
  const [query, setQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const filteredStudents = useMemo(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    return students.filter(student => 
      [student.name, student.rollNo, student.parentPhone].some(val => 
        String(val || '').toLowerCase().includes(needle)
      )
    ).slice(0, 10); // show top 10 matches
  }, [query, students]);

  const studentAttendance = useMemo(() => {
    if (!selectedStudent) return [];
    return attendance.filter(a => a.studentId === selectedStudent.id)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [selectedStudent, attendance]);

  const absentDays = useMemo(() => {
    return studentAttendance.filter(a => a.status === 'absent');
  }, [studentAttendance]);

  const chartData = useMemo(() => {
    // Generate daily percentage for chart based on cumulative attendance up to that day for the whole class, or just a simple status map.
    // Let's create a map showing 1 for present/late and 0 for absent to visualize their attendance pattern.
    return studentAttendance.map(a => ({
      date: a.date,
      value: a.status === 'present' || a.status === 'late' ? 1 : 0,
      status: a.status
    }));
  }, [studentAttendance]);

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <section className="panel" style={{ flex: '1', margin: 0 }}>
        <div className="panel-title">
          <h2>Student Search</h2>
        </div>
        <input 
          placeholder="Search by name, roll no..." 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px' }}
        />
        
        {query && filteredStudents.length === 0 && <p style={{ color: '#64748b' }}>No students found.</p>}
        
        <div className="cards">
          {filteredStudents.map(student => (
            <article 
              className="card" 
              key={student.id} 
              onClick={() => setSelectedStudent(student)}
              style={{ cursor: 'pointer', border: selectedStudent?.id === student.id ? '2px solid #3b82f6' : undefined }}
            >
              <b>{student.name}</b>
              <small>{student.className} • {student.year} Year • Roll {student.rollNo}</small>
            </article>
          ))}
        </div>
      </section>

      {selectedStudent && (
        <section className="panel" style={{ flex: '2', margin: 0 }}>
          <div className="panel-title">
            <h2>{selectedStudent.name}'s Profile</h2>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <strong>Roll No:</strong> {selectedStudent.rollNo}
            </div>
            <div>
              <strong>Class:</strong> {selectedStudent.className} ({selectedStudent.year})
            </div>
            <div>
              <strong>Parent Name:</strong> {selectedStudent.parentName || 'N/A'}
            </div>
            <div>
              <strong>Parent Phone:</strong> {selectedStudent.parentPhone}
            </div>
            {customStudentFields?.map(field => (
              <div key={field.name}>
                <strong>{field.name}:</strong> {selectedStudent[field.name] || 'N/A'}
              </div>
            ))}
          </div>

          <h3>Attendance Pattern</h3>
          {chartData.length > 0 ? (
            <div style={{ height: '200px', width: '100%', marginBottom: '24px' }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis ticks={[0, 1]} tickFormatter={(val) => val === 1 ? 'Present' : 'Absent'} />
                  <Tooltip formatter={(value, name, props) => [props.payload.status, 'Status']} />
                  <Line type="stepAfter" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: '#64748b', marginBottom: '24px' }}>No attendance records found for this student.</p>
          )}

          <h3>Absent Days ({absentDays.length})</h3>
          {absentDays.length > 0 ? (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {absentDays.map(a => (
                <li key={a.id} style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong>{a.date}</strong></span>
                  {a.subjectName && <span>{a.subjectName} ({a.startTime} - {a.endTime})</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#64748b' }}>This student has not been marked absent.</p>
          )}
        </section>
      )}
    </div>
  );
}
