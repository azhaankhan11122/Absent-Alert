import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { motion } from 'framer-motion';

function DamagedCircuit({ isOk }) {
  const groupRef = useRef();
  const mat1Ref = useRef();
  const mat2Ref = useRef();

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * (isOk ? 1 : 0.5);
    
    if (!isOk) {
      if (Math.random() > 0.9) {
        groupRef.current.position.x = (Math.random() - 0.5) * 0.15;
        groupRef.current.position.y = (Math.random() - 0.5) * 0.15;
      } else {
        groupRef.current.position.x = 0;
        groupRef.current.position.y = 0;
      }
      
      const glitchIntensity = Math.random() > 0.8 ? 4 : 0.5;
      if (mat1Ref.current) mat1Ref.current.emissiveIntensity = glitchIntensity;
      if (mat2Ref.current) mat2Ref.current.emissiveIntensity = glitchIntensity;
    } else {
        groupRef.current.position.x = 0;
        groupRef.current.position.y = 0;
        if (mat1Ref.current) mat1Ref.current.emissiveIntensity = 2;
        if (mat2Ref.current) mat2Ref.current.emissiveIntensity = 2;
    }
  });

  const color = isOk ? "#10b981" : "#ef4444"; 

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.2, 0.8, 0.2]} />
        <meshStandardMaterial ref={mat1Ref} color={color} emissive={color} wireframe />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial ref={mat2Ref} color={color} emissive={color} wireframe />
      </mesh>
    </group>
  );
}

export default function HolographicWarning({ gateway }) {
  const isOk = gateway?.ok;
  
  return (
    <motion.div 
      className={`gateway ${isOk ? 'ok' : 'bad'}`}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        position: 'relative', 
        zIndex: 1, 
        padding: '12px 16px', 
        borderRadius: '12px', 
        background: isOk ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
        border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, 
        backdropFilter: 'blur(12px)',
        boxShadow: isOk ? '0 0 15px rgba(16,185,129,0.1)' : '0 0 15px rgba(239,68,68,0.1)'
      }}
      initial={{ opacity: 0, x: 20, scale: 0.95 }}
      animate={{ 
        opacity: [0, 1, 0.5, 1],
        x: 0, 
        scale: 1,
        transition: { type: 'spring', stiffness: 200, damping: 10 }
      }}
      whileHover={{ scale: 1.02 }}
    >
      <div style={{ width: '40px', height: '40px', marginRight: '16px' }}>
        <Suspense fallback={null}>
          <Canvas camera={{ position: [0, 0, 3] }}>
            <ambientLight intensity={0.5} />
            <DamagedCircuit isOk={isOk} />
            <EffectComposer>
              <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={2} />
            </EffectComposer>
          </Canvas>
        </Suspense>
      </div>
      <div>
        <b style={{ color: isOk ? '#34d399' : '#f87171', display: 'block', marginBottom: '2px', fontSize: '14px' }}>
          {isOk ? 'ADB phone connected' : 'SMS gateway offline'}
        </b>
        <small style={{ color: 'rgba(255,255,255,0.7)', display: 'block', fontSize: '12px' }}>
          {gateway?.selected?.serial || gateway?.error || 'Connect phone and enable USB debugging'}
        </small>
      </div>
    </motion.div>
  );
}
