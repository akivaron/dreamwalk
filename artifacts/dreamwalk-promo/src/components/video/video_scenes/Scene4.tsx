import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
    >
      <motion.div
        className="absolute inset-0 opacity-50 mix-blend-screen"
        initial={{ scale: 1.5, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 8, ease: "easeOut" }}
      >
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} className="w-full h-full object-cover" />
      </motion.div>

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={phase >= 1 ? { width: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent mb-8"
        />
        
        <motion.h1 
          className="text-[9vw] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-indigo-200 font-display drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={phase >= 2 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.9 }}
          transition={{ duration: 1.5, type: "spring", bounce: 0.3 }}
        >
          DreamWalk
        </motion.h1>
        
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={phase >= 1 ? { width: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
          className="h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent mt-8"
        />
      </div>

      <motion.div 
        className="mt-16 px-12 py-6 bg-white text-black font-bold font-body text-[1.8vw] rounded-full uppercase tracking-[0.2em] relative z-10 shadow-[0_0_50px_rgba(255,255,255,0.4)] overflow-hidden group"
        initial={{ opacity: 0, scale: 0.8, y: 30 }}
        animate={phase >= 3 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 30 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent -skew-x-12"
          animate={{ x: ['-200%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
        <span className="relative z-10">Start Your Journey</span>
      </motion.div>
    </motion.div>
  );
}