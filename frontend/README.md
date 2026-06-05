# SkyThermal Front-End Layout

A React/Vite starter layout for a paragliding-focused meteo dashboard inspired by Windy/Ventusky-style weather maps, but designed for paragliding decision intelligence.

## Features included

- Dark SaaS weather dashboard layout
- Left navigation/sidebar
- Favorite flying sites
- Weather layer toggles
- Altitude wind selector
- Central weather map mock layer
- Launch markers and airspace overlays
- Right-side launch detail panel
- Flyability score and risk score cards
- GO/MAYBE/NO-GO recommendation bar
- Mini hourly forecast table
- AI flight briefing card
- Bottom weather timeline
- Responsive base styling

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Replace mock map with real map

For production, replace `MapCanvas` internals with:

- MapLibre GL JS
- vector tiles / PMTiles
- WebGL animated wind particles
- weather tile overlays
- PostGIS-backed site/airspace layers

Suggested production rendering stack:

- MapLibre GL JS for map rendering
- deck.gl for advanced overlays
- custom WebGL layer for wind particles
- PMTiles or vector tile server for offline/fast maps
- API endpoints from Volume 04 for forecast layers and launch data
