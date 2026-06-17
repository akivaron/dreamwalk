import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1500),
      setTimeout(() => setPhase(2), 3500),
      setTimeout(() => setPhase(3), 6000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-2xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 1.5 }}
    >
      <motion.div
        className="w-[70vw] h-[50vh] border border-white/20 rounded-[2rem] overflow-hidden relative shadow-[0_0_100px_rgba(167,139,250,0.4)]"
        initial={{ scale: 0.8, rotateX: 30, y: 100, opacity: 0 }}
        animate={{ scale: 1, rotateX: 0, y: 0, opacity: 1 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1000 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/world-crystal.png`} 
          className="w-full h-full object-cover scale-125 origin-center" 
        />
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Virtual Joystick UI mock */}
        <motion.div 
          className="absolute bottom-12 left-12 w-32 h-32 border-2 border-white/20 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-md shadow-inner"
          initial={{ opacity: 0, scale: 0 }} 
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}} 
          transition={{ duration: 1, type: "spring" }}
        >
          <motion.div 
            className="w-12 h-12 bg-white/80 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.8)]"
            animate={{ 
              x: [0, 40, 20, -30, -10, 0], 
              y: [0, -30, 20, 10, -40, 0] 
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Floating lyrics mock with 3D effect */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[2.5vw] font-display font-medium text-white text-center tracking-widest leading-relaxed"
          style={{ textShadow: '0 10px 30px rgba(0,0,0,0.9), 0 0 40px rgba(167,139,250,0.8)' }}
          initial={{ opacity: 0, scale: 0.8, z: -100 }}
          animate={phase >= 2 ? { opacity: 1, scale: 1, z: 0 } : {}}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          "I'm floating in the dark..."
        </motion.div>
        
        {/* Audio visualizer bars mock */}
        <div className="absolute bottom-12 right-12 flex items-end gap-2 h-16">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div 
              key={i}
              className="w-2 bg-indigo-400/80 rounded-t-full"
              initial={{ height: "10%" }}
              animate={phase >= 1 ? { height: ["10%", `${Math.random() * 80 + 20}%`, "10%"] } : {}}
              transition={{ duration: 1 + Math.random(), repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
      </motion.div>

      <motion.h2
        className="text-[4vw] text-white font-bold font-display mt-16 tracking-tight"
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        A deeply immersive journey.
      </motion.h2>
    </motion.div>
  );
}