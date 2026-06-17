---
name: Dream Wishes architecture
description: How the Dream Wishes feature bridges R3F canvas and HTML overlay, and key patterns used
---

## Pattern: R3F ↔ HTML bridge via mutable store
WishObjects (inside R3F Canvas) and DreamWishes (HTML overlay) communicate through `wishStore.ts` — a plain mutable object following the same pattern as `audioStore.ts`. `wishStore.onWishSelected` is a callback set by DreamWishes; WishObjects calls it on click.

**Why:** React context doesn't cross the R3F canvas boundary cleanly. The mutable store pattern (already used for audioLevels/dreamEvents) is the established convention in this codebase.

**How to apply:** Any new feature that needs canvas↔DOM communication should add fields to wishStore or follow the same pattern with a new store file.

## Camera tilt: wishTiltRef offset, not direct pitch mutation
Camera tilt after wishing uses `wishTiltRef` (a separate ref) subtracted from `pitch.current` to get `effectivePitch`. This avoids clobbering the player's actual drag-controlled pitch.

## Pointer event conflict: stopImmediatePropagation
WishObjects mesh `onPointerDown` calls `e.nativeEvent.stopImmediatePropagation()` to prevent the CameraRig's raw DOM `pointerdown` listener from firing when the user clicks a wish object.

## DB schema push
Run `pnpm --filter @workspace/db push` after schema changes. DB (PostgreSQL via Drizzle) is available in this Replit environment.
