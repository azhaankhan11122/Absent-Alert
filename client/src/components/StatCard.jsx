import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

export default function StatCard({ label, value, icon, color = "#3b82f6" }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-100, 100], [15, -15]);
  const rotateY = useTransform(x, [-100, 100], [-15, 15]);

  function handleMouseMove(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        perspective: 1000,
        transformStyle: 'preserve-3d',
        width: '100%',
        minWidth: '200px'
      }}
    >
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '24px',
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(16px)',
          borderRadius: '16px',
          borderTop: `2px solid ${color}`,
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
          transform: 'translateZ(30px)',
          color: 'white',
          height: '100%',
        }}
      >
        <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div>
          <b style={{ display: 'block', fontSize: '28px', lineHeight: '1.2' }}>{value}</b>
          <small style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', fontWeight: 600 }}>{label}</small>
        </div>
      </div>
    </motion.div>
  );
}
