import React, { Suspense, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// Shared Materials
const folderMaterial = new THREE.MeshPhysicalMaterial({
  color: '#1e3a8a',
  emissive: '#1e3a8a',
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.7,
  roughness: 0.2,
  metalness: 0.8,
  clearcoat: 1,
});

const activeFolderMaterial = new THREE.MeshPhysicalMaterial({
  color: '#3b82f6',
  emissive: '#3b82f6',
  emissiveIntensity: 2,
  transparent: true,
  opacity: 0.9,
  roughness: 0.1,
  metalness: 1,
});

function StudentFolderBlock({ student, index, position, isActive, onClick, onEdit, onDelete }) {
  const groupRef = useRef();
  
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const targetScale = useMemo(() => new THREE.Vector3(), []);
  const targetRotation = useMemo(() => new THREE.Euler(), []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    if (isActive) {
      // Detach and move towards camera, unfold
      targetPosition.set(0, 0, 3);
      targetScale.set(5, 5, 0.1);
      targetRotation.set(0, 0, 0);
    } else {
      // Return to rack position
      targetPosition.set(...position);
      targetScale.set(1, 1, 1);
      targetRotation.set(0, 0, 0);
    }

    groupRef.current.position.lerp(targetPosition, delta * 5);
    groupRef.current.scale.lerp(targetScale, delta * 5);
    
    // Lerp rotation manually
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotation.x, delta * 5);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation.y, delta * 5);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotation.z, delta * 5);
  });

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh material={isActive ? activeFolderMaterial : folderMaterial}>
        <boxGeometry args={[0.8, 1.2, 0.2]} />
      </mesh>
      
      {!isActive && (
        <Text
          position={[0, 0, 0.11]}
          fontSize={0.1}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.7}
        >
          {student.name}
        </Text>
      )}

      {isActive && (
        <Html transform position={[0, 0, 0.2]} scale={0.2} style={{ width: '400px', height: '500px', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', border: '2px solid #3b82f6', borderRadius: '16px', padding: '24px', color: 'white', display: 'flex', flexDirection: 'column', gap: '16px', pointerEvents: 'auto' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '2em' }}>{student.name}</h2>
            <div style={{ color: '#94a3b8', fontSize: '1.2em' }}>Roll No: {student.rollNo}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9em', color: '#cbd5e1' }}>Class</div>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{student.className}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.9em', color: '#cbd5e1' }}>Year</div>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{student.year}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.9em', color: '#cbd5e1' }}>Parent Contact</div>
              <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{student.parentName} ({student.parentPhone})</div>
            </div>
          </div>
          {student.shariyath && <div style={{ color: '#ef4444', fontWeight: 'bold' }}>Shariyath Student</div>}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(student); }} style={{ flex: 1, padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}>Edit Profile</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(student.id); }} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}>Delete</button>
          </div>
        </Html>
      )}
    </group>
  );
}

function DataRack({ students, activeStudentId, setActiveStudentId, onEdit, onDelete }) {
  const groupRef = useRef();

  // Rack animation on mount
  useFrame((state, delta) => {
    if (groupRef.current) {
       // Slow ambient rotation when nothing is selected
       if (!activeStudentId) {
         groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
       } else {
         groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, delta * 5);
       }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, -2]}>
      {students.map((student, index) => {
        // Calculate position in a grid
        const cols = 5;
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = (col - (cols - 1) / 2) * 1.2;
        const y = -(row * 1.5) + 2;
        const z = 0;

        return (
          <StudentFolderBlock
            key={student.id}
            student={student}
            index={index}
            position={[x, y, z]}
            isActive={student.id === activeStudentId}
            onClick={() => setActiveStudentId(student.id === activeStudentId ? null : student.id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      })}
    </group>
  );
}

function VaultScene({ students, searchTerm, onEdit, onDelete }) {
  const [activeStudentId, setActiveStudentId] = useState(null);
  
  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const lower = searchTerm.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(lower) || 
      s.rollNo.toLowerCase().includes(lower) ||
      (s.parentPhone && s.parentPhone.includes(lower))
    );
  }, [students, searchTerm]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      
      <DataRack 
        students={filteredStudents} 
        activeStudentId={activeStudentId} 
        setActiveStudentId={setActiveStudentId} 
        onEdit={onEdit}
        onDelete={onDelete}
      />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
      </EffectComposer>
    </>
  );
}

export default function StudentsVault3D({ students, searchTerm, onEdit, onDelete }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px', borderRadius: '24px', overflow: 'hidden', position: 'relative', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)' }}>
      <Suspense fallback={<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>Initializing Data Vault...</div>}>
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
          <VaultScene students={students} searchTerm={searchTerm} onEdit={onEdit} onDelete={onDelete} />
        </Canvas>
      </Suspense>
    </div>
  );
}
