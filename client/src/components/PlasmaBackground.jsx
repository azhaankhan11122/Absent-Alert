import React from 'react';
import { motion } from 'framer-motion';

export default function PlasmaBackground({ children }) {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
      {/* Base Gradient Layer */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -2,
          background: 'linear-gradient(135deg, #09090b 0%, #17102e 50%, #0c081c 100%)',
          backgroundSize: '300% 300%',
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{
          duration: 25,
          ease: 'linear',
          repeat: Infinity,
        }}
      />

      {/* Plasma Swirls */}
      <motion.div
        style={{
          position: 'fixed',
          top: '-25%',
          left: '-25%',
          width: '150%',
          height: '150%',
          zIndex: -1,
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15) 0%, rgba(0, 0, 0, 0) 60%)',
          pointerEvents: 'none',
          filter: 'blur(80px)'
        }}
        animate={{
          rotate: [0, 360],
          scale: [1, 1.1, 0.9, 1],
          x: ['0%', '5%', '-5%', '0%'],
          y: ['0%', '-5%', '5%', '0%']
        }}
        transition={{
          duration: 30,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      <motion.div
        style={{
          position: 'fixed',
          top: '10%',
          right: '-20%',
          width: '100%',
          height: '100%',
          zIndex: -1,
          background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.1) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
          filter: 'blur(60px)'
        }}
        animate={{
          rotate: [360, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 25,
          ease: "linear",
          repeat: Infinity,
        }}
      />

      {/* Content wrapper */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
