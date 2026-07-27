import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api/client';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimeTablesTab({ classes, timetable, teachers, timetableSlots, onUpdate }) {
  const [selectedClass, setSelectedClass] = useState(classes[0] || '');
  const [selectedYear, setSelectedYear] = useState('1st');

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    // We can drag from teacher list to a slot
    const { source, destination, draggableId } = result;
    
    if (source.droppableId === 'teachers-list' && destination.droppableId.startsWith('slot-')) {
      const [day, time] = destination.droppableId.replace('slot-', '').split('-');
      const teacherId = draggableId.replace('teacher-', '');
      const teacher = teachers.find(t => t.id === teacherId);
      
      if (teacher) {
        // Find end time (1 hour later)
        const startHour = parseInt(time.split(':')[0], 10);
        const endTime = `${(startHour + 1).toString().padStart(2, '0')}:00`;
        
        try {
          await api.createTimetable({
            day,
            className: selectedClass,
            year: selectedYear,
            subjectName: teacher.subject,
            startTime: time,
            endTime
          });
          onUpdate();
        } catch (e) {
          console.error('Failed to create timetable slot', e);
          alert('Failed to save timetable slot: ' + e.message);
        }
      }
    }
  };

  const currentTimetable = timetable.filter(t => t.className === selectedClass && t.year === selectedYear);

  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <section className="panel" style={{ flex: '1', margin: 0, minWidth: '250px' }}>
          <div className="panel-title">
            <h2>Assign Subjects</h2>
          </div>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Class</span>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Year</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
              <option value="1st">1st Year</option>
              <option value="2nd">2nd Year</option>
            </select>
          </label>

          <h4>Available Subjects & Teachers</h4>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Drag a subject onto the timetable slots.</p>
          
          <Droppable droppableId="teachers-list" isDropDisabled={true}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teachers.map((teacher, index) => (
                  <Draggable key={teacher.id} draggableId={`teacher-${teacher.id}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        style={{
                          padding: '12px',
                          backgroundColor: snapshot.isDragging ? 'var(--bg-ghost)' : 'var(--bg-panel)',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          ...provided.draggableProps.style,
                        }}
                      >
                        <strong>{teacher.subject}</strong>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{teacher.name}</div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </section>

        <section className="panel" style={{ flex: '3', margin: 0, overflowX: 'auto' }}>
          <div className="panel-title">
            <h2>Timetable for {selectedClass} ({selectedYear})</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid var(--border-config)', padding: '8px', backgroundColor: 'var(--bg-config)' }}>Time</th>
                {DAYS.map(day => (
                  <th key={day} style={{ border: '1px solid var(--border-config)', padding: '8px', backgroundColor: 'var(--bg-config)' }}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(timetableSlots || []).map(time => (
                <tr key={time}>
                  <td style={{ border: '1px solid var(--border-config)', padding: '8px', fontWeight: 'bold', backgroundColor: 'var(--bg-config)', whiteSpace: 'nowrap' }}>
                    {time}
                  </td>
                  {DAYS.map(day => {
                    const droppableId = `slot-${day}-${time}`;
                    const slotData = currentTimetable.find(t => t.day === day && t.startTime === time);
                    
                    return (
                      <td key={day} style={{ border: '1px solid #e2e8f0', padding: 0, minWidth: '120px' }}>
                        <Droppable droppableId={droppableId}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                minHeight: '80px',
                                padding: '8px',
                                backgroundColor: snapshot.isDraggingOver ? 'var(--bg-ghost)' : 'var(--bg-panel)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {slotData ? (
                                <div style={{ backgroundColor: 'var(--bg-ghost)', padding: '8px', borderRadius: '4px', width: '100%', textAlign: 'center', position: 'relative' }}>
                                  <strong>{slotData.subjectName}</strong>
                                  <button 
                                    onClick={async () => {
                                      if (confirm('Delete this slot?')) {
                                        await api.deleteTimetable(slotData.id);
                                        onUpdate();
                                      }
                                    }}
                                    style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger-color)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', border: 'none', cursor: 'pointer', fontSize: '10px' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Empty</span>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </DragDropContext>
    </div>
  );
}
