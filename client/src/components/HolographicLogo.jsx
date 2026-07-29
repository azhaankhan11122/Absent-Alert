import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

function GlowingShape() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.4;
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <Icosahedron ref={meshRef} args={[1.5, 2]} position={[0, 0, 0]}>
      <meshStandardMaterial 
        color="#8b5cf6" 
        wireframe={true} 
        emissive="#8b5cf6" 
        emissiveIntensity={2} 
        transparent 
        opacity={0.8}
      />
    </Icosahedron>
  );
}

export default function HolographicLogo() {
  return (
    <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, position: 'relative' }}>
      <Suspense fallback={<div style={{ color: '#8b5cf6', fontSize: '10px' }}>Loading...</div>}>
        <Canvas camera={{ position: [0, 0, 4] }}>
          <ambientLight intensity={0.5} />
          <GlowingShape />
          <EffectComposer>
            <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} intensity={1.5} />
          </EffectComposer>
        </Canvas>
      </Suspense>
    </div>
  );
}
