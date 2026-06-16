---
name: ElevenLabs music generation limits
description: Concurrency cap and prompt wording constraints when generating music tracks via ElevenLabs.
---

- **Max 2 concurrent generations** — batch requests in pairs, not all at once, or later calls fail.
- **Avoid trademarked or evocative-IP wording** in prompts (e.g. "Journey", "epic") — they can trigger a TOS/content rejection. Use neutral descriptive language for mood/instrumentation instead.
