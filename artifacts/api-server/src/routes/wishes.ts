import { Router } from "express";
import { eq, sql, count as drizzleCount } from "drizzle-orm";

const router = Router();

let dbMod: typeof import("@workspace/db") | null = null;

async function getDb() {
  if (dbMod) return dbMod;
  try {
    dbMod = await import("@workspace/db");
    return dbMod;
  } catch {
    return null;
  }
}

router.get("/wishes", async (req, res) => {
  const songId = String(req.query.songId ?? "").trim();
  if (!songId) {
    res.status(400).json({ error: "songId required" });
    return;
  }

  const mod = await getDb();
  if (!mod) {
    res.json({ count: 0, samples: [] });
    return;
  }

  try {
    const { db, wishesTable } = mod;

    const [row] = await db
      .select({ total: drizzleCount() })
      .from(wishesTable)
      .where(eq(wishesTable.songId, songId));

    const samples = await db
      .select()
      .from(wishesTable)
      .where(eq(wishesTable.songId, songId))
      .orderBy(sql`random()`)
      .limit(8);

    res.json({
      count: Number(row?.total ?? 0),
      samples: samples.map((w) => ({
        id: w.id,
        wishText: w.wishText,
        worldId: w.worldId,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    res.json({ count: 0, samples: [] });
  }
});

router.post("/wishes", async (req, res) => {
  const { wishText, songId, songTitle, worldId } = req.body as {
    wishText?: string;
    songId?: string;
    songTitle?: string;
    worldId?: string;
  };

  if (!wishText?.trim() || !songId || !songTitle || !worldId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (wishText.length > 200) {
    res.status(400).json({ error: "Wish too long (max 200 chars)" });
    return;
  }

  const mod = await getDb();
  if (!mod) {
    res.json({ id: -1, wishText, createdAt: new Date().toISOString() });
    return;
  }

  try {
    const { db, wishesTable } = mod;

    const [wish] = await db
      .insert(wishesTable)
      .values({
        wishText: wishText.trim(),
        songId,
        songTitle,
        worldId,
      })
      .returning();

    res.json({
      id: wish.id,
      wishText: wish.wishText,
      worldId: wish.worldId,
      createdAt: wish.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save wish" });
  }
});

export default router;
