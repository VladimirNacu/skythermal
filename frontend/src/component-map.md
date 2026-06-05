# Component Map

## App
Root layout: sidebar + map shell + right detail panel.

## Sidebar
- Brand
- Search
- Favorite sites
- Quick layers
- Drive or Don't Drive card

## MapCanvas
- Weather map mock background
- Legend
- Altitude selector
- Site markers
- Airspace overlays
- Map controls
- Timeline

## RightPanel
- Selected launch
- Metrics
- Launch window
- GO/MAYBE/NO-GO recommendation
- Mini forecast
- AI briefing

## Production TODO
- Connect layer toggles to URL/query state
- Replace static hourly data with `/v1/sites/{id}/forecast`
- Replace map mock with MapLibre
- Add authentication and entitlement gating
- Add i18n for layer names
- Add mobile/tablet responsive drawer modes
