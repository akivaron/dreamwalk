import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2, Check, Cloud, CloudRain, Disc, Droplets, Flame, Globe,
  Heart, Home, Moon, Mountain, Music, Music2, Route, Search, Share2,
  Smile, Snowflake, Sparkles, Stars, Sun, Sunrise, TreePine, User,
  Waves, Zap,
} from "lucide-react";
import type { DreamSong, LyricsData, MoodData, TrendingTrack } from "../dream/types";
import { fetchLyrics } from "../dream/api/lyrics";
import { extractKeywords, inferMood } from "../dream/keywordAnalysis";

// ─── Constants ───────────────────────────────────────────────────────────────

const MOOD_LABEL: Record<string, string> = {
  hopeful: "Hopeful", melancholic: "Melancholic", epic: "Epic", calm: "Calm",
  energetic: "Energetic", dark: "Dark", romantic: "Romantic", nostalgic: "Nostalgic",
};

function MoodIcon({ mood, className = "w-4 h-4" }: { mood: string; className?: string }) {
  const props = { className };
  switch (mood) {
    case "hopeful":    return <Smile {...props} />;
    case "melancholic":return <CloudRain {...props} />;
    case "epic":       return <Zap {...props} />;
    case "calm":       return <Waves {...props} />;
    case "energetic":  return <Flame {...props} />;
    case "dark":       return <Moon {...props} />;
    case "romantic":   return <Heart {...props} />;
    case "nostalgic":  return <Sunrise {...props} />;
    default:           return <Sparkles {...props} />;
  }
}

function ThemeIcon({ theme, className = "w-3 h-3" }: { theme: string; className?: string }) {
  const props = { className };
  switch (theme) {
    case "ocean":      return <Waves {...props} />;
    case "stars":      return <Stars {...props} />;
    case "night":      return <Moon {...props} />;
    case "rain":       return <CloudRain {...props} />;
    case "fire":       return <Flame {...props} />;
    case "snow":       return <Snowflake {...props} />;
    case "mountain":   return <Mountain {...props} />;
    case "home":       return <Home {...props} />;
    case "city":       return <Building2 {...props} />;
    case "heaven":     return <Cloud {...props} />;
    case "love":       return <Heart {...props} />;
    case "loneliness": return <User {...props} />;
    case "hope":       return <Sunrise {...props} />;
    case "sadness":    return <Droplets {...props} />;
    case "joy":        return <Sun {...props} />;
    case "journey":    return <Route {...props} />;
    case "aurora":     return <Sparkles {...props} />;
    case "forest":     return <TreePine {...props} />;
    case "desert":     return <Sun {...props} />;
    default:           return <Music {...props} />;
  }
}

function energyLabel(e: number) {
  if (e > 0.7) return "High";
  if (e > 0.4) return "Medium";
  return "Low";
}

function getLargeArtwork(url: string): string {
  if (!url) return url;
  return url.replace(/\d+x\d+bb/, "600x600bb");
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        peak: 20 + Math.abs(Math.sin(i * 0.7 + 1.2) * 28 + Math.cos(i * 0.4) * 18),
        dur: 0.22 + (i % 7) * 0.038,
        delay: i * 0.012,
      })),
    [],
  );
  return (
    <div className="flex items-end gap-[2px] h-10">
      {bars.map((b, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-full bg-white/50"
          animate={
            isPlaying
              ? { height: ["12%", `${b.peak}%`, "12%"] }
              : { height: "12%" }
          }
          transition={{
            duration: b.dur,
            repeat: isPlaying ? Infinity : 0,
            repeatType: "reverse",
            delay: b.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── useSongInsights hook ─────────────────────────────────────────────────────

const DEFAULT_MOOD: MoodData = { primary: "hopeful", secondary: null, energy: 0.5, valence: 0.6 };

interface SongInsights {
  lyrics: LyricsData | null;
  keywords: string[];
  themes: string[];
  mood: MoodData;
  loading: boolean;
}

function useSongInsights(song: DreamSong): SongInsights {
  const [ins, setIns] = useState<SongInsights>({
    lyrics: null, keywords: [], themes: [], mood: DEFAULT_MOOD, loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lyrics = await fetchLyrics(song.artist, song.title);
      if (cancelled) return;
      const text = lyrics?.raw ?? `${song.title} ${song.artist} ${song.album}`;
      const keywords = extractKeywords(text);
      const mood = inferMood(keywords, song.title, song.artist);
      setIns({ lyrics, keywords, themes: keywords.slice(0, 6), mood, loading: false });
    })();
    return () => { cancelled = true; };
  }, [song.id, song.artist, song.title, song.album]);

  return ins;
}

// ─── Track Details hook (Musixmatch analytics) ───────────────────────────────

interface TrackDetails {
  trackRating: number | null;
  trackLength: number | null;
  explicit: boolean;
  numFavourite: number | null;
  genres: string[];
  artistCountry: string | null;
  artistGenres: string[];
  loading: boolean;
}

function useTrackDetails(song: DreamSong): TrackDetails {
  const [details, setDetails] = useState<TrackDetails>({
    trackRating: null, trackLength: null, explicit: false,
    numFavourite: null, genres: [], artistCountry: null,
    artistGenres: [], loading: true,
  });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url = `/api/track-details?${new URLSearchParams({ artist: song.artist, title: song.title })}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as Partial<TrackDetails>;
        if (!cancelled) setDetails({ ...(data as TrackDetails), loading: false });
      } catch {
        if (!cancelled) setDetails((d) => ({ ...d, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [song.id, song.artist, song.title]);
  return details;
}

// ─── Country helpers ──────────────────────────────────────────────────────────

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
}

const COUNTRY_NAMES: Record<string, string> = {
  US:"United States",GB:"United Kingdom",KR:"South Korea",JP:"Japan",BR:"Brazil",
  MX:"Mexico",CA:"Canada",AU:"Australia",FR:"France",DE:"Germany",SE:"Sweden",
  NG:"Nigeria",IN:"India",CO:"Colombia",PR:"Puerto Rico",JM:"Jamaica",ZA:"South Africa",
  IT:"Italy",ES:"Spain",AR:"Argentina",CL:"Chile",NZ:"New Zealand",IE:"Ireland",
  NO:"Norway",DK:"Denmark",FI:"Finland",NL:"Netherlands",BE:"Belgium",PT:"Portugal",
  TW:"Taiwan",HK:"Hong Kong",ID:"Indonesia",PH:"Philippines",TH:"Thailand",
  MY:"Malaysia",SG:"Singapore",EG:"Egypt",AE:"UAE",SA:"Saudi Arabia",PK:"Pakistan",
  RU:"Russia",PL:"Poland",TR:"Turkey",CN:"China",VE:"Venezuela",PE:"Peru",EC:"Ecuador",
};

// ─── World Listener Map ────────────────────────────────────────────────────────

interface ListenerHub {
  name: string; country: string;
  svgX: number; svgY: number;
  base: number; boostKeys: string[];
}

const LISTENER_HUBS: ListenerHub[] = [
  { name: "New York",      country: "US", svgX: 177, svgY:  82, base: 0.90, boostKeys: ["us","hip-hop","pop","r&b","rap","country"] },
  { name: "Los Angeles",   country: "US", svgX: 103, svgY:  93, base: 0.85, boostKeys: ["us","pop","hip-hop","r&b","rap"] },
  { name: "London",        country: "GB", svgX: 300, svgY:  64, base: 0.80, boostKeys: ["gb","uk","pop","electronic","afrobeats"] },
  { name: "São Paulo",     country: "BR", svgX: 222, svgY: 189, base: 0.75, boostKeys: ["br","brazil","reggaeton","latin"] },
  { name: "Tokyo",         country: "JP", svgX: 533, svgY:  90, base: 0.75, boostKeys: ["jp","japan","j-pop","anime","k-pop"] },
  { name: "Seoul",         country: "KR", svgX: 511, svgY:  87, base: 0.70, boostKeys: ["kr","korea","k-pop","k pop"] },
  { name: "Mumbai",        country: "IN", svgX: 421, svgY: 118, base: 0.65, boostKeys: ["in","india","bollywood","pop"] },
  { name: "Paris",         country: "FR", svgX: 304, svgY:  68, base: 0.70, boostKeys: ["fr","france","pop","electronic"] },
  { name: "Berlin",        country: "DE", svgX: 322, svgY:  62, base: 0.65, boostKeys: ["de","germany","electronic","techno","edm"] },
  { name: "Mexico City",   country: "MX", svgX: 135, svgY: 118, base: 0.65, boostKeys: ["mx","mexico","reggaeton","latin","pop"] },
  { name: "Jakarta",       country: "ID", svgX: 478, svgY: 160, base: 0.60, boostKeys: ["id","indonesia","pop","k-pop"] },
  { name: "Sydney",        country: "AU", svgX: 552, svgY: 207, base: 0.60, boostKeys: ["au","australia","pop","electronic"] },
  { name: "Toronto",       country: "CA", svgX: 168, svgY:  77, base: 0.55, boostKeys: ["ca","canada","pop","hip-hop"] },
  { name: "Lagos",         country: "NG", svgX: 306, svgY: 139, base: 0.50, boostKeys: ["ng","nigeria","afrobeats","afropop"] },
  { name: "Bangkok",       country: "TH", svgX: 468, svgY: 127, base: 0.55, boostKeys: ["th","thailand","pop","k-pop"] },
  { name: "Buenos Aires",  country: "AR", svgX: 203, svgY: 208, base: 0.50, boostKeys: ["ar","argentina","reggaeton","latin","tango"] },
  { name: "Dubai",         country: "AE", svgX: 392, svgY: 108, base: 0.50, boostKeys: ["ae","arabic","pop","arabic pop"] },
  { name: "Stockholm",     country: "SE", svgX: 330, svgY:  51, base: 0.50, boostKeys: ["se","sweden","pop","electronic","edm"] },
  { name: "Manila",        country: "PH", svgX: 502, svgY: 126, base: 0.50, boostKeys: ["ph","philippines","pop","k-pop"] },
  { name: "Cairo",         country: "EG", svgX: 352, svgY: 100, base: 0.45, boostKeys: ["eg","egypt","arabic"] },
];

const NEARBY: Record<string, string[]> = {
  US:["CA","GB","AU"],  GB:["US","AU","CA","IE","SE","DE","FR"],
  KR:["JP","PH","TH","ID"],  JP:["KR"],  BR:["AR","MX"],  MX:["BR","AR"],
  SE:["DE","NO","DK","FI"],  FR:["BE","CH","DE"],  DE:["AT","CH","SE","FR"],
};

function calcHubIntensity(hub: ListenerHub, artistCountry: string | null, allGenres: string[]): number {
  let s = hub.base;
  const lc = (artistCountry ?? "").toUpperCase();
  const lg = allGenres.map((g) => g.toLowerCase());
  if (lc && lc === hub.country) s = Math.min(1, s + 0.38);
  if ((NEARBY[lc] ?? []).includes(hub.country)) s = Math.min(1, s + 0.14);
  if (hub.boostKeys.some((k) => lg.some((g) => g.includes(k)))) s = Math.min(1, s + 0.16);
  return s;
}

const CONTINENT_POLYGONS = [
  { id: "na", points: "20,50 75,33 197,33 230,50 212,72 167,108 155,123 117,112 93,70 58,53" },
  { id: "sa", points: "172,133 195,133 242,158 233,188 205,205 187,240 180,240 180,183 170,150" },
  { id: "eu", points: "285,85 285,77 292,52 325,32 347,42 400,58 347,78 343,88 327,88 292,90" },
  { id: "af", points: "278,90 358,98 385,133 367,167 347,208 330,208 320,158 313,143 272,125" },
  { id: "as", points: "343,80 387,65 455,30 608,42 570,63 517,98 492,148 433,137 395,113 360,88" },
  { id: "au", points: "490,185 525,175 543,180 552,215 530,212 492,207" },
];

function WorldListenerMap({
  artistCountry, genres, artistGenres,
}: { artistCountry: string | null; genres: string[]; artistGenres: string[] }) {
  const allGenres = useMemo(() => [...genres, ...artistGenres], [genres.join(","), artistGenres.join(",")]);
  const hubs = useMemo(
    () => LISTENER_HUBS.map((h) => ({ ...h, intensity: calcHubIntensity(h, artistCountry, allGenres) }))
      .sort((a, b) => b.intensity - a.intensity),
    [artistCountry, allGenres.join(",")],
  );
  const top5 = hubs.slice(0, 5);
  const homeHub = artistCountry ? hubs.find((h) => h.country === artistCountry.toUpperCase()) : null;

  return (
    <div className="space-y-5">
      {/* SVG map */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-[#060a14]">
        <svg viewBox="0 0 600 280" className="w-full" style={{ display: "block" }}>
          <rect width="600" height="280" fill="#060a14" />
          {/* Grid lines */}
          {[100,200,300,400,500].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={280} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          ))}
          {[70,140,210].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={600} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          ))}
          {/* Continents */}
          {CONTINENT_POLYGONS.map((c) => (
            <polygon key={c.id} points={c.points} fill="#1a2540" stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" />
          ))}
          {/* Glow gradients */}
          <defs>
            {hubs.map((h) => (
              <radialGradient key={h.name} id={`grd${h.svgX}${h.svgY}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={h.intensity * 0.65} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>
          {/* Hub dots */}
          {hubs.map((h) => {
            const r = 3 + h.intensity * 9;
            return (
              <g key={h.name}>
                <circle cx={h.svgX} cy={h.svgY} r={r * 3.5} fill={`url(#grd${h.svgX}${h.svgY})`} />
                <circle cx={h.svgX} cy={h.svgY} r={r}
                  fill="rgba(129,140,248,0.55)" fillOpacity={0.3 + h.intensity * 0.7}
                  stroke="rgba(165,180,252,0.6)" strokeWidth="0.75" />
                {h.intensity > 0.82 && (
                  <text x={h.svgX} y={h.svgY - r - 2} textAnchor="middle" fontSize="6"
                    fill="rgba(255,255,255,0.55)" fontFamily="system-ui">{h.name}</text>
                )}
              </g>
            );
          })}
          {/* Home ring */}
          {homeHub && (
            <circle cx={homeHub.svgX} cy={homeHub.svgY}
              r={3 + homeHub.intensity * 9 + 6}
              fill="none" stroke="rgba(250,204,21,0.55)" strokeWidth="1.5" strokeDasharray="3 2" />
          )}
        </svg>
        <div className="absolute bottom-2 right-3 flex gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-indigo-400/80" /><span className="text-[8px] tracking-widest text-white/30">Listeners</span></span>
          {homeHub && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border border-yellow-400/50" /><span className="text-[8px] tracking-widest text-white/30">Home</span></span>}
        </div>
      </div>
      {/* Top 5 */}
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Top Listening Cities</p>
        <div className="space-y-2">
          {top5.map((h, i) => (
            <div key={h.name} className="flex items-center gap-2">
              <span className="w-3 shrink-0 text-[10px] text-white/25">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] tracking-wide text-white/65">{h.name}</span>
                  <span className="text-[10px] text-white/40">{Math.round(h.intensity * 100)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400/60 to-violet-400/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${h.intensity * 100}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

// ─── Musical DNA Radar ────────────────────────────────────────────────────────

interface RadarDimension { label: string; value: number; color: string }

function MusicalDNARadar({ dims }: { dims: RadarDimension[] }) {
  const cx = 90; const cy = 90; const r = 68;
  const n = dims.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, ratio: number) => ({
    x: cx + Math.cos(angle(i)) * r * ratio,
    y: cy + Math.sin(angle(i)) * r * ratio,
  });
  const gridLevels = [0.25, 0.5, 0.75, 1];
  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  const dataPts = dims.map((d, i) => pt(i, Math.max(0.05, d.value)));

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 180 180" className="w-full max-w-[160px]">
        {/* Grid rings */}
        {gridLevels.map((lvl) => (
          <path
            key={lvl}
            d={toPath(dims.map((_, i) => pt(i, lvl)))}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        {/* Axis spokes */}
        {dims.map((_, i) => {
          const end = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        {/* Filled area */}
        <path
          d={toPath(dataPts)}
          fill="url(#dnaGrad)"
          fillOpacity="0.35"
          stroke="rgba(167,139,250,0.6)"
          strokeWidth="1.5"
        />
        <defs>
          <radialGradient id="dnaGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        {/* Data dots */}
        {dataPts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={dims[i].color} fillOpacity="0.9" />
        ))}
        {/* Labels */}
        {dims.map((d, i) => {
          const lp = pt(i, 1.28);
          return (
            <text
              key={i}
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="rgba(255,255,255,0.45)"
              fontFamily="system-ui"
              letterSpacing="0.08em"
            >
              {d.label.toUpperCase()}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full px-1">
        {dims.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[9px] tracking-widest text-white/40 uppercase">{d.label}</span>
            <span className="ml-auto text-[9px] text-white/55">{Math.round(d.value * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Emotional Journey sparkline ──────────────────────────────────────────────

function EmotionalJourney({ lines }: { lines: Array<{ isEmotional: boolean; type: string }> }) {
  if (lines.length === 0) return null;
  const W = 240; const H = 36; const barW = Math.max(2, Math.floor((W - lines.length) / lines.length));
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Emotional Arc</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded overflow-hidden" style={{ height: 36 }}>
        {lines.map((l, i) => {
          const x = i * (barW + 1);
          const h = l.isEmotional ? H : H * 0.28;
          const color = l.type === "chorus"
            ? "rgba(167,139,250,0.75)"
            : l.isEmotional
            ? "rgba(99,102,241,0.65)"
            : "rgba(255,255,255,0.12)";
          return (
            <rect
              key={i}
              x={x}
              y={H - h}
              width={barW}
              height={h}
              fill={color}
              rx="1"
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="flex items-center gap-1"><div className="h-1.5 w-3 rounded-full bg-purple-400/70" /><span className="text-[9px] text-white/35">Chorus</span></div>
        <div className="flex items-center gap-1"><div className="h-1.5 w-3 rounded-full bg-indigo-400/65" /><span className="text-[9px] text-white/35">Emotional</span></div>
        <div className="flex items-center gap-1"><div className="h-1.5 w-3 rounded-full bg-white/15" /><span className="text-[9px] text-white/35">Neutral</span></div>
      </div>
    </div>
  );
}

// ─── Section Breakdown bar ────────────────────────────────────────────────────

function SectionBreakdown({ sections }: { sections: { verse: string[]; chorus: string[]; bridge: string[]; outro: string[] } }) {
  const total = sections.verse.length + sections.chorus.length + sections.bridge.length + sections.outro.length;
  if (total === 0) return null;
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const parts = [
    { label: "Verse", count: sections.verse.length, color: "bg-blue-400/50" },
    { label: "Chorus", count: sections.chorus.length, color: "bg-purple-400/60" },
    { label: "Bridge", count: sections.bridge.length, color: "bg-pink-400/50" },
    { label: "Outro", count: sections.outro.length, color: "bg-white/20" },
  ].filter((p) => p.count > 0);
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Song Structure</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.label} className={`${p.color} h-full`} style={{ width: pct(p.count) }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${p.color.replace("bg-", "bg-")}`} />
            <span className="text-[9px] tracking-widest text-white/40">{p.label}</span>
            <span className="text-[9px] text-white/55">{p.count}L</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── End-of-preview modal ─────────────────────────────────────────────────────

function EndModal({
  onEnterDream,
  onClose,
  onExplore,
}: {
  onEnterDream: () => void;
  onClose: () => void;
  onExplore: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        className="relative rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 to-white/5 px-10 py-10 text-center shadow-2xl backdrop-blur-2xl max-w-sm w-full mx-6"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        <Music2 className="mx-auto mb-3 h-10 w-10 text-white/50" />
        <h3 className="text-xl font-light tracking-widest text-white">
          Continue the journey.
        </h3>
        <p className="mt-2 text-sm tracking-wide text-white/50">
          The preview has ended. Step deeper into the music.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onEnterDream}
            className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/50"
          >
            <Sparkles className="h-4 w-4" /> Enter Dream
          </button>
          <button
            onClick={onExplore}
            className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm tracking-widest text-white/70 transition-all hover:text-white hover:border-white/30"
          >
            <Search className="h-4 w-4" /> Explore Another Song
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Trending discovery cards ─────────────────────────────────────────────────

function DiscoveryCard({
  track,
  onExplore,
}: {
  track: TrendingTrack;
  onExplore: () => void;
}) {
  return (
    <motion.button
      onClick={onExplore}
      className="group flex shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/10"
      style={{ width: 140 }}
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
    >
      {track.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt={track.title}
          className="h-28 w-full rounded-xl object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <div className="flex h-28 w-full items-center justify-center rounded-xl bg-white/10 text-3xl">
          ♪
        </div>
      )}
      <span className="line-clamp-1 text-xs font-light text-white/80">{track.title}</span>
      <span className="line-clamp-1 text-[10px] text-white/45">{track.artist}</span>
    </motion.button>
  );
}

// ─── Main SongDetail component ────────────────────────────────────────────────

interface SongDetailProps {
  song: DreamSong;
  trends: TrendingTrack[];
  onEnterDream: (song: DreamSong) => void;
  onBack: () => void;
  onExploreSong?: (track: TrendingTrack) => void;
}

export function SongDetail({
  song,
  trends,
  onEnterDream,
  onBack,
  onExploreSong,
}: SongDetailProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fix scroll — body has overflow:hidden for the 3D experience
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = prev || "hidden"; };
  }, []);

  const insights = useSongInsights(song);
  const trackDetails = useTrackDetails(song);
  const largeArt = getLargeArtwork(song.artworkUrl);

  // ── Audio controls ──
  const togglePreview = () => {
    if (!song.previewUrl) return;
    if (!audioRef.current) {
      const el = new Audio(song.previewUrl);
      el.addEventListener("timeupdate", () => setProgress(el.currentTime));
      el.addEventListener("loadedmetadata", () => setAudioDuration(el.duration));
      el.addEventListener("ended", () => { setIsPlaying(false); setShowEndModal(true); });
      audioRef.current = el;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  };

  const seekTo = (ratio: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = ratio * audioRef.current.duration;
    setProgress(audioRef.current.currentTime);
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  // ── Share ──
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const progressRatio = audioDuration > 0 ? progress / audioDuration : 0;
  const moodLbl = MOOD_LABEL[insights.mood.primary] ?? insights.mood.primary;
  const energyPct = Math.round(insights.mood.energy * 100);
  const lyricsPreview = insights.lyrics?.synced.slice(0, 6) ?? [];

  // ── Lyric stats ──
  const syncedLines = insights.lyrics?.synced ?? [];
  const totalLines = syncedLines.length;
  const emotionalLines = syncedLines.filter((l) => l.isEmotional).length;
  const chorusLines = insights.lyrics?.sections.chorus.length ?? 0;
  const rawWords = insights.lyrics?.raw ? insights.lyrics.raw.trim().split(/\s+/).filter(Boolean) : [];
  const wordCount = rawWords.length;
  const uniqueWords = new Set(rawWords.map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))).size;
  const avgWordsPerLine = totalLines > 0 ? (wordCount / totalLines).toFixed(1) : "–";

  // ── Musical DNA dimensions ──
  const arousal = insights.mood.arousal ?? insights.mood.energy * 0.85;
  const complexity = insights.keywords.length > 0
    ? Math.min(1, insights.keywords.length / 12)
    : 0.4;
  const depth = totalLines > 0
    ? Math.min(1, (emotionalLines / totalLines) * 1.8 + insights.themes.length * 0.07)
    : 0.35;
  const dnaDims: Array<{ label: string; value: number; color: string }> = [
    { label: "Energy",     value: insights.mood.energy,  color: "#f87171" },
    { label: "Valence",    value: insights.mood.valence, color: "#facc15" },
    { label: "Arousal",    value: arousal,               color: "#fb923c" },
    { label: "Complexity", value: complexity,            color: "#34d399" },
    { label: "Depth",      value: depth,                 color: "#a78bfa" },
  ];

  return (
    <div className="relative min-h-screen bg-[#080c18] text-white overflow-y-auto">
      {/* ── Blurred artwork background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {song.artworkUrl && (
          <img
            src={largeArt}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-110 opacity-20"
            style={{ filter: "blur(60px)", transform: "scale(1.15)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080c18]/60 via-[#080c18]/80 to-[#080c18]" />

        {/* Pulse ring when playing */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[1, 2, 3].map((n) => (
                <motion.div
                  key={n}
                  className="absolute rounded-full border border-white/8"
                  style={{ width: `${20 + n * 22}vw`, height: `${20 + n * 22}vw` }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.05, 0.18] }}
                  transition={{ duration: 2.4, delay: n * 0.6, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-white/5 bg-[#080c18]/60">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm tracking-widest text-white/60 transition-colors hover:text-white"
        >
          <span className="text-lg leading-none">←</span>
          <span>Back</span>
        </button>
        <span className="text-xs tracking-[0.5em] text-white/30 font-light uppercase">
          DreamWalk
        </span>
        <div style={{ width: 80 }} />
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {/* ── 3-column grid ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">

          {/* ════ LEFT: Metadata ════ */}
          <motion.aside
            className="flex flex-col gap-4"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {/* Album art */}
            <div className="aspect-square w-full overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
              {song.artworkUrl ? (
                <img
                  src={largeArt}
                  alt={`${song.title} artwork`}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-6xl">
                  ♪
                </div>
              )}
            </div>

            {/* Track identity */}
            <GlassCard className="p-5">
              <p className="text-xl font-light leading-snug tracking-wide text-white">
                {song.title}
              </p>
              <p className="mt-1 text-sm text-white/55 tracking-wider">{song.artist}</p>
              {song.album && (
                <p className="mt-0.5 text-xs text-white/35 tracking-wide">{song.album}</p>
              )}
            </GlassCard>

            {/* Metadata pills */}
            <GlassCard className="p-5 flex flex-col gap-3">
              <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Details</h4>
              {song.genre && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Genre</span>
                  <span className="rounded-full border border-white/15 bg-white/8 px-3 py-0.5 text-[11px] text-white/70 tracking-wide">
                    {song.genre}
                  </span>
                </div>
              )}
              {song.source && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Source</span>
                  <span className="text-[11px] text-white/50 capitalize tracking-wide">
                    {song.source === "musixmatch" ? "Musixmatch" : song.source === "itunes" ? "Apple Music" : "Curated"}
                  </span>
                </div>
              )}
              {audioDuration > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Preview</span>
                  <span className="text-[11px] text-white/50 tracking-wide">{formatTime(audioDuration)}</span>
                </div>
              )}
              {insights.mood.source && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Analysis</span>
                  <span className="text-[11px] text-white/50 capitalize tracking-wide">
                    {insights.mood.source === "cyanite" ? "Cyanite AI" : "Heuristic"}
                  </span>
                </div>
              )}
            </GlassCard>

            {/* Musixmatch analytics */}
            {!trackDetails.loading && (trackDetails.trackRating !== null || trackDetails.artistCountry) && (
              <GlassCard className="p-5 flex flex-col gap-3">
                <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Analytics</h4>

                {trackDetails.artistCountry && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/45 tracking-wide">Origin</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-white/70 tracking-wide">
                      <span>{countryFlag(trackDetails.artistCountry)}</span>
                      <span>{COUNTRY_NAMES[trackDetails.artistCountry.toUpperCase()] ?? trackDetails.artistCountry}</span>
                    </span>
                  </div>
                )}

                {trackDetails.trackRating !== null && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-white/45 tracking-wide">Popularity</span>
                      <span className="text-[11px] text-white/60">{trackDetails.trackRating}/100</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400/50 to-orange-400/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${trackDetails.trackRating}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {trackDetails.trackLength !== null && trackDetails.trackLength > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/45 tracking-wide">Full Length</span>
                    <span className="text-[11px] text-white/60 tracking-wide">{formatTime(trackDetails.trackLength)}</span>
                  </div>
                )}

                {trackDetails.numFavourite !== null && trackDetails.numFavourite > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/45 tracking-wide">Favourites</span>
                    <span className="text-[11px] text-white/60 tracking-wide">
                      {trackDetails.numFavourite >= 1000
                        ? `${(trackDetails.numFavourite / 1000).toFixed(1)}k`
                        : String(trackDetails.numFavourite)}
                    </span>
                  </div>
                )}

                {trackDetails.explicit && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/45 tracking-wide">Content</span>
                    <span className="rounded border border-red-400/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] tracking-widest text-red-400/80">EXPLICIT</span>
                  </div>
                )}

                {trackDetails.genres.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-white/45 tracking-wide">MX Genres</p>
                    <div className="flex flex-wrap gap-1">
                      {trackDetails.genres.slice(0, 4).map((g) => (
                        <span key={g} className="rounded-full border border-amber-400/15 bg-amber-500/8 px-2 py-0.5 text-[10px] text-amber-300/60 tracking-wide">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            )}

            {/* Spotify / Apple links */}
            <GlassCard className="p-5 flex flex-col gap-2">
              <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-1">Listen On</h4>
              {song.spotifyTrackId && (
                <a
                  href={`https://open.spotify.com/track/${song.spotifyTrackId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <span className="text-[#1DB954] text-base">●</span>
                  Open in Spotify
                </a>
              )}
              <a
                href={`https://music.apple.com/search?term=${encodeURIComponent(`${song.title} ${song.artist}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <span className="text-[#FC3C44] text-base">●</span>
                Apple Music
              </a>
            </GlassCard>
          </motion.aside>

          {/* ════ CENTER: Hero + Player ════ */}
          <motion.main
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          >
            {/* Hero art banner */}
            <div className="relative overflow-hidden rounded-3xl" style={{ minHeight: 260 }}>
              {song.artworkUrl && (
                <>
                  <img
                    src={largeArt}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover scale-110"
                    style={{ filter: "blur(24px)", opacity: 0.55 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080c18] via-[#080c18]/40 to-transparent" />
                </>
              )}
              <div className="relative z-10 flex h-full flex-col justify-end p-8">
                {/* Animated artwork */}
                <motion.div
                  className="mb-6 flex justify-center"
                  animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: 2.8, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
                >
                  {song.artworkUrl ? (
                    <img
                      src={largeArt}
                      alt={song.title}
                      className="h-32 w-32 rounded-2xl object-cover shadow-[0_16px_60px_rgba(0,0,0,0.8)]"
                    />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10 text-5xl">
                      ♪
                    </div>
                  )}
                </motion.div>

                <h1 className="text-3xl font-light tracking-[0.06em] text-white drop-shadow-lg">
                  {song.title}
                </h1>
                <p className="mt-1 text-base tracking-[0.15em] text-white/60">{song.artist}</p>
              </div>
            </div>

            {/* Action buttons */}
            <GlassCard className="p-6">
              <div className="flex flex-wrap gap-3">
                {/* Preview */}
                {song.previewUrl ? (
                  <motion.button
                    onClick={togglePreview}
                    className="flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/25"
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{isPlaying ? "⏸" : "▶"}</span>
                    <span>{isPlaying ? "Pause" : "Preview"}</span>
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/35 cursor-not-allowed">
                    <span>▶</span>
                    <span>No Preview</span>
                  </div>
                )}

                {/* Enter Dream */}
                <motion.button
                  onClick={() => onEnterDream(song)}
                  className="flex items-center gap-2 rounded-full border border-white/40 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 px-5 py-2.5 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:from-indigo-500/50 hover:to-purple-500/50 hover:border-white/60"
                  whileTap={{ scale: 0.96 }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Enter Dream</span>
                </motion.button>

                {/* Save */}
                <motion.button
                  onClick={() => setIsSaved((s) => !s)}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  whileTap={{ scale: 0.96 }}
                >
                  <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </motion.button>

                {/* Share */}
                <motion.button
                  onClick={() => void handleShare()}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  whileTap={{ scale: 0.96 }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                  <span>{copied ? "Copied!" : "Share"}</span>
                </motion.button>
              </div>

              {/* Preview player */}
              <div className="mt-5 space-y-3">
                <WaveformBars isPlaying={isPlaying} />

                {/* Progress bar */}
                {song.previewUrl && (
                  <div className="space-y-1.5">
                    <div
                      className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/10 overflow-hidden"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo((e.clientX - rect.left) / rect.width);
                      }}
                    >
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/70"
                        style={{ width: `${progressRatio * 100}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] tracking-widest text-white/40">
                      <span>{formatTime(progress)}</span>
                      <span>{audioDuration > 0 ? formatTime(audioDuration) : "0:30"}</span>
                    </div>
                  </div>
                )}

                {!song.previewUrl && (
                  <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center">
                    <p className="text-sm text-white/50 tracking-wide">No official preview available.</p>
                    <div className="mt-3 flex justify-center gap-3">
                      <button
                        onClick={() => onEnterDream(song)}
                        className="rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/15 hover:text-white"
                      >
                        <Sparkles className="inline h-3.5 w-3.5 mr-1.5" />Enter Dream anyway
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Lyrics preview */}
            <GlassCard className="p-6">
              <h3 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
                Lyrics Preview
              </h3>
              {insights.loading ? (
                <div className="flex items-center gap-2 text-sm text-white/30">
                  <motion.span
                    className="block h-3 w-3 rounded-full border border-white/30 border-t-white/70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  />
                  Loading lyrics...
                </div>
              ) : lyricsPreview.length > 0 ? (
                <div className="space-y-2">
                  {lyricsPreview.map((line, i) => (
                    <motion.p
                      key={i}
                      className="flex items-start gap-2 text-sm font-light leading-relaxed tracking-wide"
                      style={{ color: line.isEmotional ? "rgba(167,139,250,0.85)" : "rgba(255,255,255,0.68)" }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: line.type === "chorus" ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.22)" }}>
                        {line.type === "chorus" ? <Disc className="h-3 w-3" /> : <Music className="h-3 w-3" />}
                      </span>
                      <span>{line.text}</span>
                    </motion.p>
                  ))}
                  <p className="mt-3 text-xs tracking-widest text-white/25 italic">
                    Enter Dream to experience the full song visually.
                  </p>
                </div>
              ) : (
                <p className="text-sm tracking-wide text-white/40 italic">
                  Enter Dream to experience the song visually.
                </p>
              )}
            </GlassCard>

            {/* Emotional Journey + Section Breakdown */}
            {!insights.loading && syncedLines.length > 0 && (
              <GlassCard className="p-6 space-y-5">
                <h3 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Song Analysis</h3>
                <EmotionalJourney lines={syncedLines} />
                {insights.lyrics && (
                  <SectionBreakdown sections={insights.lyrics.sections} />
                )}
              </GlassCard>
            )}

            {/* Lyric Statistics */}
            {!insights.loading && totalLines > 0 && (
              <GlassCard className="p-6">
                <h3 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">Lyric Statistics</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Lines",      value: totalLines },
                    { label: "Words",      value: wordCount || "–" },
                    { label: "Unique",     value: uniqueWords || "–" },
                    { label: "Avg Words",  value: avgWordsPerLine },
                    { label: "Emotional",  value: emotionalLines },
                    { label: "Chorus",     value: chorusLines },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-white/8 bg-white/3 px-3 py-3 text-center">
                      <p className="text-lg font-light text-white/85">{value}</p>
                      <p className="mt-0.5 text-[9px] uppercase tracking-[0.25em] text-white/35">{label}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </motion.main>

          {/* ════ RIGHT: Song Insights ════ */}
          <motion.aside
            className="flex flex-col gap-4"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          >
            <GlassCard className="p-5">
              <h3 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
                Song Insights
              </h3>

              {insights.loading ? (
                <div className="flex items-center gap-2 text-sm text-white/30">
                  <motion.span
                    className="block h-3 w-3 rounded-full border border-white/30 border-t-white/70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  />
                  Analysing...
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Mood */}
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-white/35">Mood</p>
                    <div className="flex items-center gap-2">
                      <MoodIcon mood={insights.mood.primary} className="h-6 w-6 text-white/80" />
                      <span className="text-sm tracking-wide text-white/80">{moodLbl}</span>
                    </div>
                  </div>

                  {/* Energy */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Energy</p>
                      <span className="text-xs text-white/50 tracking-wider">
                        {energyLabel(insights.mood.energy)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400/60 to-purple-400/80"
                        initial={{ width: 0 }}
                        animate={{ width: `${energyPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] tracking-widest text-white/25">
                      <span>Low</span><span>High</span>
                    </div>
                  </div>

                  {/* Themes */}
                  {insights.themes.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.themes.map((t) => (
                          <span
                            key={t}
                            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] tracking-wide text-white/65"
                          >
                            <ThemeIcon theme={t} className="h-3 w-3" />
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {insights.keywords.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.keywords.slice(0, 10).map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[10px] tracking-widest text-white/45 lowercase"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mood tags from Cyanite */}
                  {insights.mood.moodTags && insights.mood.moodTags.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Mood Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.mood.moodTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] tracking-wide text-indigo-300/70 capitalize"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Genre tags from Cyanite */}
                  {insights.mood.genreTags && insights.mood.genreTags.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Genre Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.mood.genreTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] tracking-wide text-emerald-300/65 capitalize"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta stats */}
                  <div className="space-y-2 border-t border-white/8 pt-4">
                    <div className="flex justify-between">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Language</span>
                      <span className="text-[11px] text-white/55 tracking-wider">English</span>
                    </div>
                    {song.genre && (
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Genre</span>
                        <span className="text-[11px] text-white/55 tracking-wider">{song.genre}</span>
                      </div>
                    )}
                    {audioDuration > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Preview</span>
                        <span className="text-[11px] text-white/55 tracking-wider">{formatTime(audioDuration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Enter Dream CTA */}
                  <motion.button
                    onClick={() => onEnterDream(song)}
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-500/25 to-purple-600/25 py-4 text-sm tracking-[0.3em] text-white/90 backdrop-blur-md transition-all hover:from-indigo-500/40 hover:to-purple-600/40 hover:border-white/40"
                    whileTap={{ scale: 0.97 }}
                  >
                    <Sparkles className="inline h-4 w-4 mr-2" />Enter Dream
                  </motion.button>
                </div>
              )}
            </GlassCard>

            {/* Valence card */}
            {!insights.loading && (
              <GlassCard className="p-5">
                <h4 className="mb-3 text-[10px] uppercase tracking-[0.4em] text-white/40">Emotional Tone</h4>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] tracking-widest text-white/35">
                      <span>Sad</span><span>Joyful</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-blue-400/50 to-yellow-300/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${insights.mood.valence * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.7 }}
                      />
                    </div>
                  </div>
                  {insights.mood.secondary && (
                    <div className="flex items-center gap-2 mt-1">
                      <MoodIcon mood={insights.mood.secondary ?? ""} className="h-4 w-4 text-white/60" />
                      <p className="text-[11px] tracking-wide text-white/40">
                        {MOOD_LABEL[insights.mood.secondary] ?? insights.mood.secondary} undertone
                      </p>
                    </div>
                  )}
                  {/* Valence % */}
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Positivity</span>
                    <span className="text-[11px] text-white/55">{Math.round(insights.mood.valence * 100)}%</span>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Musical DNA */}
            {!insights.loading && (
              <GlassCard className="p-5">
                <h4 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">Musical DNA</h4>
                <MusicalDNARadar dims={dnaDims} />
              </GlassCard>
            )}

            {/* Arousal stat */}
            {!insights.loading && (
              <GlassCard className="p-5 space-y-4">
                <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Audio Profile</h4>
                {[
                  { label: "Arousal",    value: arousal,                color: "from-orange-400/50 to-red-400/60" },
                  { label: "Complexity", value: complexity,             color: "from-emerald-400/50 to-teal-400/60" },
                  { label: "Depth",      value: depth,                  color: "from-violet-400/50 to-purple-500/70" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">{label}</span>
                      <span className="text-[11px] text-white/50">{Math.round(value * 100)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${value * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </GlassCard>
            )}
          </motion.aside>
        </div>

        {/* ── World Listener Map ── */}
        <motion.section
          className="mt-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          <GlassCard className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Global Listeners</h2>
              {trackDetails.artistCountry && (
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                  <span>{countryFlag(trackDetails.artistCountry)}</span>
                  <span className="tracking-wide">{COUNTRY_NAMES[trackDetails.artistCountry.toUpperCase()] ?? trackDetails.artistCountry} artist</span>
                </span>
              )}
            </div>
            <WorldListenerMap
              artistCountry={trackDetails.artistCountry}
              genres={[...trackDetails.genres, ...(insights.mood.genreTags ?? []), song.genre].filter(Boolean)}
              artistGenres={trackDetails.artistGenres}
            />
          </GlassCard>
        </motion.section>

        {/* ── Discovery section ── */}
        {trends.length > 0 && (
          <motion.section
            className="mt-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
              Trending Dreams
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
              {trends.map((track) => (
                <DiscoveryCard
                  key={track.id}
                  track={track}
                  onExplore={() => onExploreSong?.(track)}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {/* ── End-of-preview modal ── */}
      <AnimatePresence>
        {showEndModal && (
          <EndModal
            onEnterDream={() => { setShowEndModal(false); onEnterDream(song); }}
            onClose={() => setShowEndModal(false)}
            onExplore={() => { setShowEndModal(false); onBack(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
