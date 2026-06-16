import { motion, AnimatePresence } from "framer-motion";

interface DreamLoadingScreenProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  step: string;
  visible: boolean;
}

export function DreamLoadingScreen({ title, artist, artworkUrl, step, visible }: DreamLoadingScreenProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ background: "radial-gradient(ellipse at 50% 40%, #1a1a2e 0%, #0a0a12 100%)" }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              backgroundImage: `radial-gradient(ellipse 60% 60% at 50% 50%, rgba(140,80,255,0.18) 0%, transparent 70%)`,
            }}
          />

          {artworkUrl && (
            <motion.div
              className="mb-8 h-32 w-32 overflow-hidden rounded-2xl"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ boxShadow: "0 0 60px rgba(140,80,255,0.35)" }}
            >
              <img
                src={artworkUrl}
                alt={title}
                className="h-full w-full object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            </motion.div>
          )}

          <motion.div
            className="relative text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
          >
            <p className="font-display text-2xl font-light tracking-[0.35em] text-white">
              {title.toUpperCase()}
            </p>
            <p className="mt-2 text-sm tracking-[0.3em] text-white/50">{artist.toUpperCase()}</p>
          </motion.div>

          <motion.div
            className="mt-10 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-white/50"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.22,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>

          <motion.p
            key={step}
            className="mt-4 text-xs tracking-[0.3em] text-white/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {step.toUpperCase()}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
