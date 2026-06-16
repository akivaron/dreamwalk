import type { MoodData, MoodPrimary } from "./types";
import type { World } from "../types";

const KEYWORD_MAP: Record<string, string[]> = {
  ocean: ["ocean", "sea", "wave", "waves", "tide", "shore", "beach", "coast", "water", "sail", "sailed", "drift", "current", "deep", "abyss", "abyss", "bay"],
  stars: ["stars", "star", "galaxy", "cosmos", "constellation", "milky way", "universe", "stardust", "celestial", "infinite", "nebula"],
  night: ["night", "midnight", "dusk", "darkness", "dark", "shadow", "shadows", "moon", "moonlight", "lunar", "nocturnal", "2am", "3am", "tonight"],
  rain: ["rain", "raining", "storm", "thunder", "lightning", "downpour", "drizzle", "wet", "flood", "tears", "weep", "cry", "crying"],
  fire: ["fire", "flame", "flames", "burn", "burning", "blaze", "ember", "embers", "heat", "warmth", "glow", "ignite", "spark", "ashes"],
  snow: ["snow", "winter", "cold", "frost", "frozen", "ice", "blizzard", "freeze", "glacier", "tundra", "arctic"],
  mountain: ["mountain", "mountains", "peak", "summit", "cliff", "canyon", "valley", "highland", "ridge", "steep", "altitude", "ascent"],
  home: ["home", "house", "return", "belong", "family", "roots", "hometown", "mother", "father", "childhood", "memory", "memories", "where i'm from"],
  city: ["city", "cities", "urban", "street", "streets", "neon", "skyline", "downtown", "highway", "traffic", "crowd", "concrete"],
  heaven: ["heaven", "paradise", "above", "sky", "clouds", "divine", "angel", "angels", "sacred", "holy", "ethereal", "transcend"],
  love: ["love", "heart", "beloved", "romance", "kiss", "embrace", "forever", "together", "soulmate", "adore", "devotion"],
  loneliness: ["alone", "lonely", "loneliness", "empty", "silence", "lost", "void", "hollow", "isolation", "solitude", "abandoned"],
  hope: ["hope", "light", "dawn", "rise", "new", "begin", "tomorrow", "faith", "dream", "believe", "possibility", "someday"],
  sadness: ["sad", "grief", "sorrow", "mourn", "loss", "pain", "hurt", "broken", "shattered", "devastated", "despair", "heartbreak"],
  joy: ["joy", "happy", "happiness", "celebrate", "laugh", "smile", "free", "alive", "soar", "fly", "dance"],
  journey: ["journey", "road", "path", "walk", "wander", "travel", "distant", "horizon", "ahead", "onward", "quest"],
  aurora: ["aurora", "northern lights", "borealis", "ethereal", "shimmer", "glow", "radiant"],
  forest: ["forest", "tree", "trees", "woods", "leaves", "green", "nature", "wild", "jungle"],
  desert: ["desert", "sand", "dunes", "drought", "arid", "vast", "empty", "horizon"],
};

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
}

export function extractKeywords(lyricsText: string): string[] {
  const tokens = tokenize(lyricsText);
  const found = new Set<string>();

  for (const [theme, words] of Object.entries(KEYWORD_MAP)) {
    for (const w of words) {
      const wTokens = w.split(" ");
      if (wTokens.length === 1) {
        if (tokens.includes(w)) {
          found.add(theme);
          break;
        }
      } else {
        if (lyricsText.toLowerCase().includes(w)) {
          found.add(theme);
          break;
        }
      }
    }
  }

  return Array.from(found);
}

export function inferMood(keywords: string[], songTitle: string, artist: string): MoodData {
  const titleLower = (songTitle + " " + artist).toLowerCase();

  let energy = 0.5;
  let valence = 0.5;

  const hasOcean = keywords.includes("ocean");
  const hasNight = keywords.includes("night");
  const hasRain = keywords.includes("rain");
  const hasSnow = keywords.includes("snow");
  const hasFire = keywords.includes("fire");
  const hasMountain = keywords.includes("mountain");
  const hasCity = keywords.includes("city");
  const hasHope = keywords.includes("hope");
  const hasSadness = keywords.includes("sadness");
  const hasJoy = keywords.includes("joy");
  const hasLoneliness = keywords.includes("loneliness");
  const hasLove = keywords.includes("love");
  const hasJourney = keywords.includes("journey");
  const hasHeaven = keywords.includes("heaven");
  const hasStars = keywords.includes("stars");

  if (hasSadness || hasRain || hasSnow || hasLoneliness) valence -= 0.25;
  if (hasJoy || hasHope || hasLove) valence += 0.2;
  if (hasNight || hasLoneliness) valence -= 0.1;
  if (hasHeaven || hasStars) valence += 0.1;

  if (hasFire || hasCity || hasMountain) energy += 0.2;
  if (hasOcean || hasSnow) energy -= 0.15;
  if (hasRain) energy -= 0.1;
  if (hasJoy) energy += 0.15;

  energy = Math.max(0, Math.min(1, energy));
  valence = Math.max(0, Math.min(1, valence));

  const titleHints: Array<[RegExp, MoodPrimary]> = [
    [/sad|sorrow|grief|broken|pain|hurt|lost|alone|empty/i, "melancholic"],
    [/happy|joy|celebrate|laugh|free|alive|dance/i, "energetic"],
    [/hope|light|dawn|rise|believe|dream|faith/i, "hopeful"],
    [/love|heart|romance|adore|forever|together/i, "romantic"],
    [/epic|legend|warrior|power|glory|triumph/i, "epic"],
    [/night|dark|shadow|midnight|moon/i, "dark"],
    [/calm|peace|still|quiet|gentle|soft/i, "calm"],
    [/remember|memory|old|past|once|years ago/i, "nostalgic"],
  ];

  let primary: MoodPrimary = "hopeful";
  for (const [re, mood] of titleHints) {
    if (re.test(titleLower)) {
      primary = mood;
      break;
    }
  }

  if (primary === "hopeful") {
    if (valence < 0.35) primary = hasSnow || hasRain ? "melancholic" : "dark";
    else if (valence > 0.7 && energy > 0.6) primary = "energetic";
    else if (valence > 0.65) primary = "hopeful";
    else if (energy < 0.35) primary = "calm";
  }

  const secondary: MoodPrimary | null =
    hasLove && primary !== "romantic" ? "romantic" :
    hasNight && primary !== "dark" ? "dark" :
    hasHope && primary !== "hopeful" ? "hopeful" :
    null;

  return { primary, secondary, energy, valence };
}

export function selectWorldId(keywords: string[], mood: MoodData): string {
  if (keywords.includes("ocean") || keywords.includes("rain")) {
    if (mood.primary === "melancholic" || mood.primary === "dark") return "midnight-ocean";
    return "midnight-ocean";
  }
  if (keywords.includes("snow") || keywords.includes("night")) {
    if (mood.primary === "dark" || mood.primary === "melancholic") return "eternal-winter";
  }
  if (mood.primary === "epic" || (mood.energy > 0.75 && mood.valence > 0.6)) return "crimson-dusk";
  if (mood.primary === "hopeful" || mood.primary === "romantic") {
    if (mood.valence > 0.65) return "golden-sunrise";
  }
  if (mood.primary === "calm" || mood.primary === "nostalgic") return "mystic-valley";
  if (mood.primary === "dark" || mood.primary === "melancholic") return "eternal-winter";
  if (mood.primary === "energetic") return "crimson-dusk";
  return "savana-valley";
}

export function buildWorldOverrides(keywords: string[], mood: MoodData): Partial<World> {
  const featOverrides: Partial<World["features"]> = {};

  if (keywords.includes("stars") || keywords.includes("night")) featOverrides.stars = true;
  if (keywords.includes("aurora") || keywords.includes("heaven")) featOverrides.aurora = true;
  if (keywords.includes("ocean") || keywords.includes("home")) featOverrides.water = true;
  if (keywords.includes("snow")) { featOverrides.snow = true; featOverrides.embers = false; }
  if (keywords.includes("fire")) featOverrides.embers = true;
  if (keywords.includes("heaven") || keywords.includes("journey")) { featOverrides.islands = true; featOverrides.clouds = true; }

  const overrides: Partial<World> = {};
  if (Object.keys(featOverrides).length > 0) overrides.features = featOverrides as World["features"];

  if (mood.primary === "dark") {
    overrides.fogDensity = 0.0062;
    overrides.ambientIntensity = 0.38;
    overrides.lightIntensity = 0.95;
  } else if (mood.primary === "epic") {
    overrides.bloom = 1.4;
    overrides.sunSize = 68;
    overrides.ambientIntensity = 0.65;
    overrides.lightIntensity = 1.5;
  } else if (mood.primary === "calm") {
    overrides.fogDensity = 0.0038;
    overrides.ambientIntensity = 0.55;
    overrides.bloom = 0.75;
  }

  return overrides;
}

export function buildNarrationText(song: { title: string; artist: string }, mood: MoodData, keywords: string[]): string {
  const moodPhrases: Record<MoodPrimary, string[]> = {
    hopeful: [
      "A world of possibility and soft light waits ahead.",
      "Hope carries you forward into this golden place.",
      "The music speaks of new beginnings.",
    ],
    melancholic: [
      "A world touched by rain and quiet longing.",
      "The music holds a beautiful sadness you can walk inside.",
      "Step into a landscape shaped by bittersweet feeling.",
    ],
    epic: [
      "A vast and powerful world unfolds around you.",
      "The music calls you to something greater than yourself.",
      "Enter a landscape of myth and grandeur.",
    ],
    calm: [
      "A still and peaceful world, patient as water.",
      "The music breathes gently, and so does this place.",
      "Rest for a moment inside this quiet dream.",
    ],
    energetic: [
      "A living, pulsing world that moves with the beat.",
      "The music surges — and so does this land.",
      "Feel the ground respond to every rhythm.",
    ],
    dark: [
      "A world of deep shadows and hidden beauty.",
      "The music descends somewhere ancient and profound.",
      "Step into the dark, where strange things glow.",
    ],
    romantic: [
      "A world built for two, warm and full of longing.",
      "The music speaks of someone, somewhere.",
      "Let this place remind you what it feels like to love.",
    ],
    nostalgic: [
      "A world that feels like a memory you can almost touch.",
      "The music reaches for something half-remembered.",
      "Walk through a landscape made of the past.",
    ],
  };

  const phrases = moodPhrases[mood.primary];
  const idx = Math.floor(Math.random() * phrases.length);
  return phrases[idx];
}

export function detectImportantLines(lines: string[]): string[] {
  const important: string[] = [];
  const emotionalWords = /love|light|lost|alone|forever|never|always|broken|home|free|heart|fall|rise|end|begin|remember|forget|dream|soul|breath|tears|fire|ocean|star/i;
  for (const line of lines) {
    if (line.length > 20 && emotionalWords.test(line)) {
      important.push(line.trim());
    }
  }
  return important.slice(0, 8);
}
