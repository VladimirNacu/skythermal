import { create } from "zustand";
import type { OverlayId } from "@/design/layer-registry";
import type { PilotLevel } from "@/api/types";

export type AltitudeM = 0 | 500 | 1000 | 1500 | 2000 | 3000;
export type ForecastModel =
  | "auto_best"
  | "ecmwf"
  | "gfs"
  | "met_norway"
  | "icon"
  | "arome";

export interface MapView {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SkyThermalMapState {
  overlay: OverlayId;
  altitudeM: AltitudeM;
  forecastModel: ForecastModel;
  validTime: string; // ISO timestamp
  selectedSiteId?: string;
  selectedPoint?: { lat: number; lon: number };
  pilotLevel: PilotLevel;
  airspaceEnabled: boolean;
  particlesEnabled: boolean;
  isolinesEnabled: boolean;
  timelinePlaying: boolean;
  map: MapView;

  // actions
  set: (patch: Partial<SkyThermalMapState>) => void;
  selectSite: (siteId: string) => void;
  clearSelection: () => void;
  setOverlay: (overlay: OverlayId) => void;
  setAltitude: (altitudeM: AltitudeM) => void;
  setValidTime: (validTime: string) => void;
  togglePlay: () => void;
  toggleAirspace: () => void;
  toggleParticles: () => void;
}

// ── URL <-> state serialization ────────────────────────────────────────────
const DEFAULT_VIEW: MapView = {
  center: [9.5, 61.3], // central Norway — matches seeded sites
  zoom: 7,
  bearing: 0,
  pitch: 0,
};

function readFromUrl(): Partial<SkyThermalMapState> {
  const p = new URLSearchParams(window.location.search);
  const out: Partial<SkyThermalMapState> = {};
  const overlay = p.get("overlay") as OverlayId | null;
  if (overlay) out.overlay = overlay;
  const altitude = p.get("altitude");
  if (altitude) out.altitudeM = Number(altitude) as AltitudeM;
  const model = p.get("model") as ForecastModel | null;
  if (model) out.forecastModel = model;
  const time = p.get("time");
  if (time) out.validTime = time;
  const site = p.get("site");
  if (site) out.selectedSiteId = site;
  const pilot = p.get("pilot") as PilotLevel | null;
  if (pilot) out.pilotLevel = pilot;
  if (p.get("airspace")) out.airspaceEnabled = p.get("airspace") === "1";

  const lat = p.get("lat");
  const lon = p.get("lon");
  const zoom = p.get("zoom");
  if (lat && lon) {
    out.map = {
      ...DEFAULT_VIEW,
      center: [Number(lon), Number(lat)],
      zoom: zoom ? Number(zoom) : DEFAULT_VIEW.zoom,
    };
  }
  return out;
}

let urlWriteTimer: number | undefined;
function writeToUrl(s: SkyThermalMapState) {
  window.clearTimeout(urlWriteTimer);
  urlWriteTimer = window.setTimeout(() => {
    const p = new URLSearchParams();
    p.set("overlay", s.overlay);
    p.set("altitude", String(s.altitudeM));
    p.set("model", s.forecastModel);
    p.set("time", s.validTime);
    p.set("pilot", s.pilotLevel);
    p.set("airspace", s.airspaceEnabled ? "1" : "0");
    if (s.selectedSiteId) p.set("site", s.selectedSiteId);
    p.set("lat", s.map.center[1].toFixed(4));
    p.set("lon", s.map.center[0].toFixed(4));
    p.set("zoom", s.map.zoom.toFixed(1));
    const url = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState(null, "", url);
  }, 250);
}

const initial = readFromUrl();

export const useMapStore = create<SkyThermalMapState>((set, get) => {
  const store: SkyThermalMapState = {
    overlay: initial.overlay ?? "surface_wind",
    altitudeM: initial.altitudeM ?? 1000,
    forecastModel: initial.forecastModel ?? "auto_best",
    validTime: initial.validTime ?? new Date().toISOString(),
    selectedSiteId: initial.selectedSiteId,
    selectedPoint: undefined,
    pilotLevel: initial.pilotLevel ?? "intermediate",
    airspaceEnabled: initial.airspaceEnabled ?? true,
    particlesEnabled: true,
    isolinesEnabled: false,
    timelinePlaying: false,
    map: initial.map ?? DEFAULT_VIEW,

    set: (patch) => {
      set(patch);
      writeToUrl(get());
    },
    selectSite: (siteId) => {
      set({ selectedSiteId: siteId });
      writeToUrl(get());
    },
    clearSelection: () => {
      set({ selectedSiteId: undefined, selectedPoint: undefined });
      writeToUrl(get());
    },
    setOverlay: (overlay) => {
      set({ overlay });
      writeToUrl(get());
    },
    setAltitude: (altitudeM) => {
      set({ altitudeM });
      writeToUrl(get());
    },
    setValidTime: (validTime) => {
      set({ validTime, timelinePlaying: false });
      writeToUrl(get());
    },
    togglePlay: () => set({ timelinePlaying: !get().timelinePlaying }),
    toggleAirspace: () => {
      set({ airspaceEnabled: !get().airspaceEnabled });
      writeToUrl(get());
    },
    toggleParticles: () => set({ particlesEnabled: !get().particlesEnabled }),
  };
  return store;
});
