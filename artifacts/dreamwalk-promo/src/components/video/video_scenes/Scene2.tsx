import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const worlds = [
  { img: 'world-forest.png', name: 'Forest', color: 'text-emerald-300' },
  { img: 'world-desert.png', name: 'Desert', color: 'text-orange-300' },
  { img: 'world-cityscape.png', name: 'Cityscape', color: 'text-blue-300' },
  { img: 'world-sakura.png', name: 'Sakura Garden', color: 'text-pink-300' },
  { img: 'world-crystal.png', name: 'Crystal Cave', color: 'text-purple-300' },
  { img: 'world-ocean.png', name: 'Ocean', color: 'text-cyan-300' }
];

export function Scene2() {
  const [activeWorld, setActiveWorld] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const phaseTimer = setTimeout(() => setPhase(1), 1000);
    
    // Total scene time: 15s. We have 6 worlds. 15000 / 6 = 2500ms per world.
    const interval = setInterval(() => {
      setActiveWorld(prev => {
        if (prev < worlds.length - 1) return prev + 1;
        return prev;
      });
    }, 2200);

    return () => {
      clearTimeout(phaseTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 z-20 flex items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: 1.5 }}
    >
      {worlds.map((world, index) => (
        <motion.div
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ 
            opacity: activeWorld === index ? 1 : 0,
            scale: activeWorld === index ? 1 : 1.1
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/${world.img}`} 
            className="w-full h-full object-cover mix-blend-screen opacity-90" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        </motion.div>
      ))}

      <div className="absolute bottom-[15vh] left-[10vw]">
        <motion.div 
          className="overflow-hidden"
          initial={{ opacity: 0, width: 0 }} 
          animate={phase >= 1 ? { opacity: 1, width: "100%" } : {}} 
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <p className="text-white/70 text-[1.8vw] font-mono mb-4 tracking-[0.2em] uppercase whitespace-nowrap">
            Generative 3D Environments
          </p>
        </motion.div>
        
        <div className="h-[9vw] overflow-hidden relative">
          <motion.div
            animate={{ y: `-${activeWorld * 9}vw` }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {worlds.map((world, i) => (
              <div key={i} className={`h-[9vw] flex items-center text-[7vw] font-black font-display ${world.color} drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]`}>
                {world.name}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      
      {/* HUD Elements for tech feel */}
      <motion.div 
        className="absolute top-[10vh] right-[10vw] flex flex-col gap-2"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : {}}
        transition={{ duration: 1 }}
      >
        <div className="w-[15vw] h-[2px] bg-white/20 relative">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-white/80"
            animate={{ width: `${((activeWorld + 1) / worlds.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="text-right text-white/50 font-mono text-[1vw]">
          LOADING_ENVIRONMENT_{activeWorld + 1}/6
        </div>
      </motion.div>
    </motion.div>
  );
}