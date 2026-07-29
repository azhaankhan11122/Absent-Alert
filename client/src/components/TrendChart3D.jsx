import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Box, Grid } from '@react-three/drei';
import * as THREE from 'three';

function Landscape({ data }) {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  const { points, columns } = useMemo(() => {
    if (!data || data.length === 0) return { points: [], columns: [] };
    
    const maxAbsent = Math.max(...data.map(d => d.absent), 1);
    const spacing = 1.2;
    const offset = (data.length * spacing) / 2;

    const pointsArray = [];
    const columnsArray = [];

    data.forEach((d, i) => {
      const x = (i * spacing) - offset + (spacing / 2);
      const normalizedAbsent = d.absent / maxAbsent;
      const height = normalizedAbsent * 3; // max height 3
      const attendancePercent = parseFloat(d.attendancePercent) / 100;
      const lineY = attendancePercent * 4; // max height 4
      
      pointsArray.push(new THREE.Vector3(x, lineY, 0));
      columnsArray.push({
        position: [x, height / 2, 0],
        height: Math.max(height, 0.1),
        label: d.date,
        value: d.absent
      });
    });

    return { points: pointsArray, columns: columnsArray };
  }, [data]);

  return (
    <group ref={groupRef} position={[0, -1.5, 0]}>
      {/* Receding Grid Floor */}
      <Grid 
        position={[0, 0, 0]} 
        args={[40, 40]} 
        cellSize={0.5} 
        cellThickness={1} 
        cellColor="#6366f1" 
        sectionSize={2.5}
        sectionThickness={1.5}
        sectionColor="#8b5cf6" 
        fadeDistance={25}
        fadeStrength={1}
      />

      {/* 3D Rectangular Columns for Absent Count */}
      {columns.map((col, idx) => (
        <Box key={idx} position={col.position} args={[0.6, col.height, 0.6]}>
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.5} transparent opacity={0.8} wireframe={false} />
        </Box>
      ))}

      {/* Glowing Tube for Attendance % */}
      {points.length > 1 && (
        <mesh>
          <tubeGeometry args={[new THREE.CatmullRomCurve3(points), 64, 0.08, 8, false]} />
          <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
}

export default function TrendChart3D({ data }) {
  return (
    <div style={{ width: '100%', height: '400px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
      <Canvas camera={{ position: [0, 3, 10], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Landscape data={data} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
