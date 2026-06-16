---
name: SongDetail Analytics
description: Musixmatch track-details API endpoint and WorldListenerMap component details
---

## /api/track-details endpoint (dream.ts)

Calls Musixmatch in two sequential fetches:
1. `track.search?q_track=...&q_artist=...` → gets track_id, artist_id, track_rating, track_length, explicit, num_favourite, primary_genres
2. `artist.get?artist_id=...` → gets artist_country (2-letter ISO), primary_genres

Returns JSON: `{ trackRating, trackLength, explicit, numFavourite, genres[], artistCountry, artistGenres[] }`

## WorldListenerMap component (SongDetail.tsx)

- SVG 600×300 equirectangular projection (x = (lon+180)*1.667, y = (90-lat)*1.667)
- 6 simplified continent polygons as `<polygon points="...">` shapes
- 20 LISTENER_HUBS with pre-computed svgX/svgY coordinates and genre boostKeys
- `calcHubIntensity`: base + 0.38 home-country + 0.14 nearby-country + 0.16 genre match
- Yellow dashed ring marks artist home hub; indigo glowing circles for all hubs
- Top 5 cities shown below map with animated bars

## Scroll fix

`body { overflow: hidden }` in index.css blocks Song Detail page scroll.
Fix: useEffect in SongDetail sets `document.body.style.overflow = "auto"` on mount, restores on unmount.

**Why:** The `overflow: hidden` on body is intentional for the 3D walk experience but must be temporarily lifted for the scroll-heavy detail page.
