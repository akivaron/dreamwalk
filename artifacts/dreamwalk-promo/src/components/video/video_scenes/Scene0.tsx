import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene0() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 3000),
      setTimeout(() => setPhase(3), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
      transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative">
        <motion.div 
          className="absolute -inset-20 bg-indigo-500/20 blur-[100px] rounded-full"
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.h1 
          className="text-[10vw] font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-100 to-indigo-400 font-display relative z-10 drop-shadow-2xl"
          initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
          animate={phase >= 1 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 50, filter: 'blur(10px)' }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          DreamWalk
        </motion.h1>
      </div>

      <motion.p 
        className="text-[2vw] text-indigo-200 mt-6 font-body tracking-[0.5em] uppercase opacity-80"
        initial={{ opacity: 0, y: 20, letterSpacing: '0.1em' }}
        animate={phase >= 2 ? { opacity: 1, y: 0, letterSpacing: '0.5em' } : { opacity: 0, y: 20, letterSpacing: '0.1em' }}
        transition={{ duration: 2, ease: "easeOut" }}
      >
        Walk inside your music
      </motion.p>

      {/* Floating particles specific to scene0 */}
      {Array.from({ length: 15 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-indigo-300/40 blur-sm"
          initial={{
            x: `${Math.random() * 100}vw`,
            y: `${Math.random() * 100}vh`,
            opacity: 0,
            scale: Math.random() * 0.5 + 0.5
          }}
          animate={{
            y: [null, `${Math.random() * -20 - 10}vh`],
            opacity: [0, 0.8, 0]
          }}
          transition={{
            duration: Math.random() * 3 + 3,
            repeat: Infinity,
            delay: Math.random() * 2
          }}
        />
      ))}
    </motion.div>
  );
}