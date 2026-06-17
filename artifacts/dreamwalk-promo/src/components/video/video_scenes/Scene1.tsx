import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 1000),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 4000),
      setTimeout(() => setPhase(4), 7000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-between px-[12vw] z-10"
      initial={{ opacity: 0, x: 200 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -200, filter: 'blur(20px)' }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-[45%]">
        <motion.h2 
          className="text-[4.5vw] font-bold text-white font-display leading-tight"
          initial={{ opacity: 0, x: -50 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          Every song has a <span className="text-indigo-400">soul.</span>
        </motion.h2>
        <motion.p 
          className="text-[1.8vw] text-white/60 mt-6 font-body leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          Analyzing tempo, genre, and energy to build your world.
        </motion.p>
      </div>

      <div className="w-[35vw] space-y-8">
        {[
          { label: "Tempo", val: "120 BPM", color: "bg-blue-400", shadow: "shadow-blue-500/50" },
          { label: "Energy", val: "High", color: "bg-pink-400", shadow: "shadow-pink-500/50" },
          { label: "Mood", val: "Ethereal", color: "bg-purple-400", shadow: "shadow-purple-500/50" }
        ].map((item, i) => (
          <motion.div 
            key={i}
            className="w-full bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex justify-between items-center shadow-2xl relative overflow-hidden"
            initial={{ opacity: 0, x: 100, rotateX: 45 }}
            animate={phase >= 3 ? { opacity: 1, x: 0, rotateX: 0 } : { opacity: 0, x: 100, rotateX: 45 }}
            transition={{ duration: 1, delay: i * 0.3, type: "spring", bounce: 0.4 }}
          >
            {/* Animated scanning line effect */}
            {phase >= 4 && (
              <motion.div 
                className="absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-transparent via-white/50 to-transparent blur-sm"
                animate={{ x: ['0%', '400vw'] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
              />
            )}
            
            <span className="text-white/60 font-mono text-[1.4vw] tracking-wider">{item.label}</span>
            <div className="flex items-center gap-6">
              <span className="text-white font-bold font-display text-[1.8vw]">{item.val}</span>
              <motion.div 
                className={`w-4 h-4 rounded-full ${item.color} shadow-[0_0_20px_rgba(255,255,255,0.5)]`}
                animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}