import React, { Suspense, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Octahedron, TorusKnot, Sphere, Box } from '@react-three/drei';

function AttendanceIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 1.5;
      ref.current.rotation.x += delta * 0.5;
    }
  });
  return (
    <group ref={ref}>
      <Sphere args={[0.5, 16, 16]}>
        <meshStandardMaterial color="#10b981" wireframe emissive="#10b981" emissiveIntensity={2} />
      </Sphere>
    </group>
  );
}

function StudentsIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta;
  });
  return (
    <group ref={ref}>
      <Sphere args={[0.25, 8, 8]} position={[0, 0.2, 0]}>
        <meshStandardMaterial color="#3b82f6" wireframe emissive="#3b82f6" emissiveIntensity={2} />
      </Sphere>
      <Box args={[0.5, 0.3, 0.3]} position={[0, -0.2, 0]}>
        <meshStandardMaterial color="#3b82f6" wireframe emissive="#3b82f6" emissiveIntensity={2} />
      </Box>
    </group>
  );
}

function SearchIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 1.5;
      ref.current.rotation.z += delta * 0.5;
    }
  });
  return (
    <group ref={ref}>
      <TorusKnot args={[0.2, 0.05, 32, 8]}>
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2} />
      </TorusKnot>
    </group>
  );
}

function TimeTablesIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x += delta * 0.8;
      ref.current.rotation.z += delta * 0.8;
    }
  });
  return (
    <Box ref={ref} args={[0.6, 0.6, 0.6]}>
      <meshStandardMaterial color="#8b5cf6" wireframe emissive="#8b5cf6" emissiveIntensity={2} />
    </Box>
  );
}

function TeachersIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.2;
  });
  return (
    <Octahedron ref={ref} args={[0.5, 0]}>
      <meshStandardMaterial color="#ec4899" wireframe emissive="#ec4899" emissiveIntensity={2} />
    </Octahedron>
  );
}

function SMSQueueIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.1;
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
  });
  return (
    <Box ref={ref} args={[0.6, 0.4, 0.1]}>
      <meshStandardMaterial color="#14b8a6" wireframe emissive="#14b8a6" emissiveIntensity={2} />
    </Box>
  );
}

function SettingsIcon() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.z += delta * 1.5;
  });
  return (
    <TorusKnot ref={ref} args={[0.3, 0.08, 64, 8]} p={2} q={3}>
      <meshStandardMaterial color="#64748b" wireframe emissive="#64748b" emissiveIntensity={1} />
    </TorusKnot>
  );
}

const TABS = [
  { id: 'attendance', label: 'Attendance', Icon: AttendanceIcon },
  { id: 'students', label: 'Students', Icon: StudentsIcon },
  { id: 'student-search', label: 'Search', Icon: SearchIcon },
  { id: 'timetables', label: 'Time Tables', Icon: TimeTablesIcon },
  { id: 'teachers', label: 'Teachers', Icon: TeachersIcon },
  { id: 'sms', label: 'SMS Queue', Icon: SMSQueueIcon },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Navigation({ view, setView }) {
  const [hoveredTab, setHoveredTab] = useState(null);
  
  return (
    <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '16px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', marginBottom: '24px' }}>
      {TABS.map((tab) => {
        const isActive = view === tab.id;
        
        return (
          <motion.button
            key={tab.id}
            onClick={() => setView(tab.id)}
            onHoverStart={() => setHoveredTab(tab.id)}
            onHoverEnd={() => setHoveredTab(null)}
            style={{
              position: 'relative',
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderRadius: '10px',
              outline: 'none',
              zIndex: 1
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
                  borderRadius: '10px',
                  boxShadow: '0 0 15px rgba(139, 92, 246, 0.3)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  zIndex: -1
                }}
                initial={false}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              />
            )}
            
            <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isActive ? (
                <Suspense fallback={null}>
                  <Canvas camera={{ position: [0, 0, 2] }} style={{ pointerEvents: 'none' }}>
                    <ambientLight intensity={1} />
                    <tab.Icon />
                  </Canvas>
                </Suspense>
              ) : (
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: hoveredTab === tab.id ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
              )}
            </div>
            
            <span>{tab.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
