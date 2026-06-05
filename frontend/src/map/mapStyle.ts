import type { StyleSpecification } from "maplibre-gl";

// A dark, terrain-friendly style built on free raster tiles so the app renders
// with no API key. Swap in a vector style + key (MapTiler/Stadia) for production
// by setting VITE_MAP_STYLE_URL.

export const DARK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  name: "skythermal-dark",
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
    },
    hillshade: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade_Dark/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#06101d" } },
    { id: "carto", type: "raster", source: "carto-dark", paint: { "raster-opacity": 0.92 } },
    {
      id: "hillshade",
      type: "raster",
      source: "hillshade",
      paint: { "raster-opacity": 0.22 },
    },
  ],
};

export function resolveStyle(): string | StyleSpecification {
  const custom = import.meta.env.VITE_MAP_STYLE_URL;
  return custom ?? DARK_RASTER_STYLE;
}
