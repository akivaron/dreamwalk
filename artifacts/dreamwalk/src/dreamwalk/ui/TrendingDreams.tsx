import { motion } from "framer-motion";
import { Music } from "lucide-react";
import type { TrendingTrack } from "../dream/types";

interface TrendingDreamsProps {
  tracks: TrendingTrack[];
  onExplore: (track: TrendingTrack) => void;
}

export function TrendingDreams({ tracks, onExplore }: TrendingDreamsProps) {
  if (tracks.length === 0) return null;

  return (
    <motion.section
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 1 }}
    >
      <h2 className="mb-3 text-center text-xs font-medium uppercase tracking-[0.4em] text-white/50">
        Trending Dreams
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {tracks.map((track) => (
          <motion.button
            key={track.id}
            onClick={() => onExplore(track)}
            className="group shrink-0 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-center backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10"
            style={{ width: 100 }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
          >
            {track.artworkUrl ? (
              <img
                src={track.artworkUrl}
                alt={track.title}
                className="h-14 w-14 rounded-lg object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-white/40"><Music className="w-5 h-5" /></span>
            )}
            <span className="line-clamp-1 w-full text-center text-xs font-light text-white/80 leading-snug">
              {track.title}
            </span>
            <span className="line-clamp-1 w-full text-center text-[10px] text-white/45 leading-snug">
              {track.artist}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
