import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Search, Star, Plus, Wind, CloudSun, CloudRain, Zap, Eye,
  Thermometer, Mountain, Gauge, Car, Navigation, Layers,
  Crosshair, Maximize, Ruler, Play, Pause, ChevronDown,
  MapPin, Plane, BrainCircuit, Clock, ShieldAlert, Cloud, Activity,
  AlertTriangle, Loader, Compass
} from "lucide-react";
import "./styles.css";

// ─── API ─────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080";

const api = {
  listSites: (q) => {
    const url = new URL(`${BASE}/v1/sites`, window.location.origin);
    if (q) url.searchParams.set("q", q);
    return fetch(url).then(r => r.json());
  },

  siteFlyabilityTimeline: (siteId, pilotLevel = "intermediate", days = 1) =>
    fetch(`${BASE}/v1/flyability/sites/${siteId}/timeline?pilot_level=${pilotLevel}&days=${days}`).then(r => r.json()),

  siteWeatherHourly: (siteId, days = 1) =>
    fetch(`${BASE}/v1/weather/sites/${siteId}/hourly?days=${days}`).then(r => r.json()),

  recommendations: (lat, lon, radiusKm = 400, pilotLevel = "intermediate") =>
    fetch(`${BASE}/v1/sites/recommendations?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&pilot_level=${pilotLevel}`).then(r => r.json()),

  windGrid: (minLat, maxLat, minLon, maxLon, step, altitudeM = 0) => {
    const p = new URLSearchParams({
      min_lat: minLat.toFixed(2), max_lat: maxLat.toFixed(2),
      min_lon: minLon.toFixed(2), max_lon: maxLon.toFixed(2),
      step:    step.toFixed(2),   altitude_m: altitudeM,
    });
    return fetch(`${BASE}/v1/weather/wind-grid?${p}`).then(r => r.json());
  },

  briefing: (siteId, pilotLevel = "intermediate") => {
    const now = new Date().toISOString();
    const end = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    return fetch(`${BASE}/v1/briefings/site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Is it safe to fly today?",
        site_id: siteId,
        pilot_profile: { pilot_level: pilotLevel },
        start: now,
        end,
        include_sources: true,
      }),
    }).then(r => r.json());
  },
};

// ─── CartoDB Dark Matter basemap (no API key) ─────────────────────────────────
const MAP_STYLE = {
  version: 8,
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  sources: {
    carto: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© <a href='https://carto.com/'>CARTO</a> © <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
    },
  },
  layers: [{ id: "carto-dark", type: "raster", source: "carto" }],
};

// ─── Layer Registry (PDF §8) ──────────────────────────────────────────────────
const LAYER_REGISTRY = [
  { id: "surface_wind",        label: "Surface Wind",          icon: Wind,        group: "Launch Safety", altitudeSelector: false },
  { id: "altitude_wind",       label: "Wind at Altitude",      icon: Wind,        group: "Launch Safety", altitudeSelector: true  },
  { id: "gusts",               label: "Gusts",                 icon: Activity,    group: "Launch Safety", altitudeSelector: false },
  { id: "thermals",            label: "Thermals",              icon: Gauge,       group: "Thermal",        altitudeSelector: false },
  { id: "cloudbase",           label: "Cloudbase",             icon: Cloud,       group: "Thermal",        altitudeSelector: false },
  { id: "cape_instability",    label: "CAPE / Instability",    icon: ShieldAlert, group: "Thermal",        altitudeSelector: false },
  { id: "rain_radar",          label: "Rain Radar",            icon: CloudRain,   group: "Weather",        altitudeSelector: false },
  { id: "lightning",           label: "Lightning",             icon: Zap,         group: "Weather",        altitudeSelector: false },
  { id: "visibility",          label: "Visibility",            icon: Eye,         group: "Weather",        altitudeSelector: false },
  { id: "temperature_dewpoint",label: "Temperature / Dewpoint",icon: Thermometer, group: "Weather",        altitudeSelector: false },
  { id: "wave_rotor_risk",     label: "Wave / Rotor Risk",     icon: Mountain,    group: "Danger",         altitudeSelector: false },
  { id: "foehn_indicator",     label: "Foehn Indicator",       icon: Wind,        group: "Danger",         altitudeSelector: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CSS = { GO: "green", MAYBE: "yellow", NO_GO: "red", UNKNOWN: "muted" };
const STATUS_HEX = { GO: "#43b547", MAYBE: "#f2b632", NO_GO: "#e84d5b", UNKNOWN: "#4a7090" };

function statusColor(status) { return STATUS_CSS[status] ?? "red"; }
function statusHex(status)   { return STATUS_HEX[status]  ?? "#4a7090"; }

function fmtTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useAsync(asyncFn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState(s => ({ ...s, loading: true, error: null }));
    asyncFn()
      .then(data => { if (alive) setState({ data, loading: false, error: null }); })
      .catch(err  => { if (alive) setState({ data: null, loading: false, error: err.message }); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function useMapState() {
  const [state, setState] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      overlay:         p.get("overlay")  ?? "altitude_wind",
      altitudeM:       Number(p.get("altitude")) || 1000,
      forecastModel:   p.get("model")    ?? "auto_best",
      airspaceEnabled: p.get("airspace") !== "false",
    };
  });

  const update = useCallback((patch) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      const p = new URLSearchParams(window.location.search);
      p.set("overlay",  next.overlay);
      p.set("altitude", next.altitudeM);
      p.set("model",    next.forecastModel);
      p.set("airspace", next.airspaceEnabled);
      window.history.replaceState(null, "", "?" + p.toString());
      return next;
    });
  }, []);

  return [state, update];
}

// ─── Small components ─────────────────────────────────────────────────────────
function Spinner() {
  return <div className="spinner-wrap"><Loader size={22} className="spin" /></div>;
}

function ErrorBanner({ message }) {
  return (
    <div className="errorBanner">
      <AlertTriangle size={16} />
      <span>{message}</span>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ sites, activeSiteId, onSelectSite, bestStatus, mapState, onMapStateChange, searchQuery, onSearchChange }) {
  const driveStatus = bestStatus ?? "UNKNOWN";
  const driveColor  = statusColor(driveStatus);
  const driveCopy   = {
    GO:      "Great day ahead!\nWorth the drive.",
    MAYBE:   "Conditions marginal.\nAssess on site.",
    NO_GO:   "Unsafe today.\nStay home.",
    UNKNOWN: "Loading…",
  }[driveStatus];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">▰</div>
        <span>SkyThermal</span>
      </div>

      <div className="searchBox">
        <Search size={16} />
        <input
          placeholder="Search location or site…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        <kbd>⌘ K</kbd>
      </div>

      <div className="sideHeader">
        <span>Launch Sites</span>
        <button className="iconButton small"><Plus size={15} /></button>
      </div>

      <div className="favorites">
        {sites.map(site => (
          <button
            className={`favoriteItem ${activeSiteId === site.id ? "active" : ""}`}
            key={site.id}
            onClick={() => onSelectSite(site)}
          >
            <MapPin size={14} />
            <span>
              <b>{site.name}</b>
              <small>{site.region} · {site.country_code}</small>
            </span>
            <Star size={14} className={activeSiteId === site.id ? "starOn" : ""} />
          </button>
        ))}
      </div>

      <div className="sideHeader layersHeader">
        <span>Overlay</span>
      </div>

      <div className="layerList">
        {LAYER_REGISTRY.map(layer => {
          const Icon = layer.icon;
          const active = mapState.overlay === layer.id;
          return (
            <button
              className={`layerRow ${active ? "active" : ""}`}
              key={layer.id}
              onClick={() => onMapStateChange({ overlay: layer.id })}
            >
              <Icon size={15} />
              <span>{layer.label}</span>
              {layer.altitudeSelector && active && <em>{mapState.altitudeM} m</em>}
              <i className={`toggle ${active ? "on" : ""}`} />
            </button>
          );
        })}
      </div>

      <div className="driveCard">
        <div className="cardTitle">
          <span>Drive or Don't Drive</span>
          <button>?</button>
        </div>
        <div className="driveGauge">
          <div className="gaugeArc" />
          <Car size={38} />
          <strong style={{ color: `var(--${driveColor})` }}>
            {driveStatus.replace("_", "-")}
          </strong>
          <p>{driveCopy}</p>
          <a>Show details →</a>
        </div>
      </div>
    </aside>
  );
}

// ─── MapLibre marker DOM builder ──────────────────────────────────────────────
// Uses flexbox column (no absolute positioning) so MapLibre overflow:hidden can't clip children.
function buildMarkerEl(site, status, windDeg, windKmh, isActive, onClick) {
  const color  = isActive ? "#2f9bff" : statusHex(status);
  const blowTo = windDeg != null ? (windDeg + 180) % 360 : 0;

  const el = document.createElement("div");
  el.className = "ml-marker" + (isActive ? " is-active" : "");

  // Wind arrow — rendered ABOVE the pin in flex column order
  const windHtml = windDeg != null ? `
    <div class="ml-wind">
      <svg width="18" height="18" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${blowTo},11,11)">
          <line x1="11" y1="17" x2="11" y2="4" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
          <polygon points="11,1 6.5,8.5 15.5,8.5" fill="${color}"/>
        </g>
      </svg>
      <span class="ml-wind-spd" style="color:${color}">${windKmh}</span>
    </div>` : "";

  el.innerHTML = `
    ${windHtml}
    <div class="ml-pin" style="background:${color}">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="white">
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
      </svg>
    </div>
    <div class="ml-label">${site.name}</div>
  `;

  el.addEventListener("click", e => { e.stopPropagation(); onClick(); });
  return el;
}

// ─── MapLibre core ────────────────────────────────────────────────────────────
function MapLibreMap({ sites, activeSiteId, onSelectSite, siteStatuses, onMapReady }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [8.5, 61.2],
      zoom: 7,
      maxZoom: 15,
      minZoom: 2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      setMapReady(true);
      onMapReady?.(map);
    });
    onMapReady?.(map);
    mapRef.current = map;

    return () => {
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build markers when data changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || !sites?.length) return;

    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    sites.forEach(site => {
      if (site.lat == null || site.lon == null) return;
      const info    = siteStatuses?.[site.id] ?? {};
      const status  = info.status  ?? "UNKNOWN";
      const windDeg = info.windDeg ?? null;
      const windKmh = info.windKmh != null ? Math.round(info.windKmh) : null;
      const isActive = site.id === activeSiteId;

      const el = buildMarkerEl(site, status, windDeg, windKmh, isActive, () => onSelectSite(site));

      // anchor:'center' so lat/lon aligns with the pin circle in the flex column
      markersRef.current[site.id] = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([site.lon, site.lat])
        .addTo(mapRef.current);
    });
  }, [sites, mapReady, siteStatuses, activeSiteId]);

  // Fly to active site
  useEffect(() => {
    if (!mapRef.current || !mapReady || !activeSiteId || !sites?.length) return;
    const site = sites.find(s => s.id === activeSiteId);
    if (!site?.lat) return;
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.easeTo({
      center: [site.lon, site.lat],
      zoom: Math.max(currentZoom, 9),
      duration: 700,
    });
  }, [activeSiteId, mapReady]);

  return <div ref={containerRef} className="mapContainer" />;
}

// ─── Wind particle system ─────────────────────────────────────────────────────
const WIND_OVERLAYS = new Set(["surface_wind", "altitude_wind", "gusts"]);
const NUM_PARTICLES = 3500;

const WIND_RAMP = [
  [0,  [38,  123, 212]],
  [10, [56,  152, 220]],
  [20, [64,  190, 196]],
  [30, [55,  180, 100]],
  [40, [220, 200,  50]],
  [50, [230, 120,  40]],
  [60, [220,  60,  70]],
  [80, [115,  43, 206]],
];

function windParticleColor(kmh, alpha) {
  let i = 0;
  while (i < WIND_RAMP.length - 1 && WIND_RAMP[i + 1][0] <= kmh) i++;
  if (i >= WIND_RAMP.length - 1) {
    const [r, g, b] = WIND_RAMP[WIND_RAMP.length - 1][1];
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const t  = (kmh - WIND_RAMP[i][0]) / (WIND_RAMP[i + 1][0] - WIND_RAMP[i][0]);
  const c0 = WIND_RAMP[i][1], c1 = WIND_RAMP[i + 1][1];
  const l  = (a, b) => Math.round(a + t * (b - a));
  return `rgba(${l(c0[0],c1[0])},${l(c0[1],c1[1])},${l(c0[2],c1[2])},${alpha})`;
}

function buildWindGrid(pts) {
  if (!pts?.length) return null;
  const lats = [...new Set(pts.map(p => +p.lat.toFixed(3)))].sort((a, b) => a - b);
  const lons = [...new Set(pts.map(p => +p.lon.toFixed(3)))].sort((a, b) => a - b);
  if (lats.length < 2 || lons.length < 2) return null;
  const lookup = {};
  pts.forEach(p => { lookup[`${p.lat.toFixed(3)},${p.lon.toFixed(3)}`] = p; });
  const data = lats.map(lat => lons.map(lon => lookup[`${lat.toFixed(3)},${lon.toFixed(3)}`] ?? null));
  return { lats, lons, data,
    stepLat: lats[1] - lats[0], stepLon: lons[1] - lons[0],
    minLat: lats[0], maxLat: lats.at(-1), minLon: lons[0], maxLon: lons.at(-1) };
}

function interpWind(lng, lat, grid) {
  if (!grid || lat < grid.minLat || lat > grid.maxLat || lng < grid.minLon || lng > grid.maxLon) return null;
  const col = (lng - grid.minLon) / grid.stepLon;
  const row = (lat - grid.minLat) / grid.stepLat;
  const c0  = Math.floor(col), c1 = Math.min(c0 + 1, grid.lons.length - 1);
  const r0  = Math.floor(row), r1 = Math.min(r0 + 1, grid.lats.length - 1);
  const fc  = col - c0, fr = row - r0;
  const get = (r, c) => grid.data[r]?.[c];
  const w00 = get(r0,c0), w10 = get(r0,c1), w01 = get(r1,c0), w11 = get(r1,c1);
  if (!w00) return null;
  const bi  = k => {
    const a = w00[k] ?? 0, b = (w10 ?? w00)[k] ?? 0;
    const c = (w01 ?? w00)[k] ?? 0, d = (w11 ?? w00)[k] ?? 0;
    return (1-fc)*(1-fr)*a + fc*(1-fr)*b + (1-fc)*fr*c + fc*fr*d;
  };
  return { u: bi("u_ms"), v: bi("v_ms"), speed: bi("speed_kmh") };
}

function computeGridStep(map) {
  const zoom  = map.getZoom();
  const lat   = map.getCenter().lat;
  const mpp   = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  const pxPer = (111320 * Math.cos(lat * Math.PI / 180)) / mpp;
  const step  = 70 / pxPer;
  return Math.max(0.5, Math.min(2.5, Math.round(step * 4) / 4));
}

function WindParticles({ gridData, map }) {
  const frameRef = useRef(null);
  const gridRef  = useRef(null);
  const pclsRef  = useRef([]);

  useEffect(() => {
    gridRef.current = gridData?.grid?.length ? buildWindGrid(gridData.grid) : null;
  }, [gridData]);

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();
    const mapCanvas = map.getCanvas();

    const canvas = document.createElement("canvas");
    // mix-blend-mode:screen makes particles glow on the dark map without covering it
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen;opacity:0.9;";
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    const scatter = (W, H) => {
      pclsRef.current = Array.from({ length: NUM_PARTICLES }, () => ({
        x:      Math.random() * W,
        y:      Math.random() * H,
        age:    Math.floor(Math.random() * 80),
        maxAge: 60 + Math.floor(Math.random() * 80),
      }));
    };

    const sync = () => {
      const W = mapCanvas.offsetWidth;
      const H = mapCanvas.offsetHeight;
      if (W > 0 && H > 0 && (canvas.width !== W || canvas.height !== H)) {
        canvas.width  = W;
        canvas.height = H;
        scatter(W, H);
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(mapCanvas);

    // Smooth swirling synthetic field — used before API data arrives
    const synWind = (x, y) => {
      const a = Math.sin(y * 0.008) * 1.2 + Math.cos(x * 0.006) * 1.8;
      const s = 0.7 + Math.sin((x + y) * 0.005) * 0.5;
      return { u: Math.cos(a) * s, v: Math.sin(a) * s, speed: s * 3.6 * 8 };
    };

    const frame = () => {
      frameRef.current = requestAnimationFrame(frame);
      const W = canvas.width, H = canvas.height;
      if (!W || !H) return;

      // destination-in: fade existing pixels toward transparent (keeps canvas see-through in empty areas)
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.93)";
      ctx.fillRect(0, 0, W, H);

      // lighter (additive): particles glow, bright where many overlap
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.5;

      const grid    = gridRef.current;
      const zoom    = map.getZoom();
      const pxPerMs = 1.8 * Math.pow(2, (zoom - 8) * 0.3);
      const FLOOR   = 2.5;

      for (const p of pclsRef.current) {
        let w = null;
        if (grid) {
          const ll = map.unproject([p.x, p.y]);
          w = interpWind(ll.lng, ll.lat, grid);
        }
        if (!w) w = synWind(p.x, p.y);

        const sm  = Math.sqrt(w.u * w.u + w.v * w.v);
        const em  = Math.max(sm, FLOOR);
        const sc  = sm > 0.01 ? em / sm : 1;
        const nx  = p.x + w.u * sc * pxPerMs;
        const ny  = p.y - w.v * sc * pxPerMs;

        p.age++;
        if (p.age > p.maxAge || nx < -10 || nx > W + 10 || ny < -10 || ny > H + 10) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.age = 0;
          p.maxAge = 80 + Math.floor(Math.random() * 80);
          continue;
        }

        const spd   = w.speed ?? sm * 3.6;
        const alpha = Math.min(0.8, p.age / 15) * Math.max(0.3, Math.min(1, spd / 15));
        ctx.strokeStyle = windParticleColor(spd, alpha);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        p.x = nx;
        p.y = ny;
      }
    };

    frame();

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [map]);

  return null;
}

// ─── Map Canvas (overlays + timeline) ────────────────────────────────────────
function MapCanvas({ sites, activeSiteId, onSelectSite, siteStatuses, weather, mapState, onMapStateChange, forecastDays, onForecastDaysChange }) {
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [windGrid,    setWindGrid]    = useState(null);
  const ALTITUDES = [500, 1000, 1500, 2000, 3000];
  const isWind = WIND_OVERLAYS.has(mapState.overlay);

  useEffect(() => {
    if (!isWind || !mapInstance) {
      if (!isWind) setWindGrid(null);
      return;
    }
    let tid;

    const refresh = () => {
      clearTimeout(tid);
      tid = setTimeout(async () => {
        const b    = mapInstance.getBounds();
        const step = computeGridStep(mapInstance);
        const altM = mapState.overlay === "altitude_wind" ? mapState.altitudeM : 0;
        try {
          const data = await api.windGrid(
            b.getSouth() - 0.5, b.getNorth() + 0.5,
            b.getWest()  - 0.5, b.getEast()  + 0.5,
            step, altM,
          );
          setWindGrid(data);
        } catch (e) {
          console.error("wind-grid fetch failed:", e);
        }
      }, 300);
    };

    mapInstance.on("moveend", refresh);
    mapInstance.on("zoomend", refresh);
    refresh();
    return () => {
      clearTimeout(tid);
      mapInstance.off("moveend", refresh);
      mapInstance.off("zoomend", refresh);
    };
  }, [isWind, mapInstance, mapState.overlay, mapState.altitudeM]);

  return (
    <main className="mapShell">
      <MapLibreMap
        sites={sites}
        activeSiteId={activeSiteId}
        onSelectSite={onSelectSite}
        siteStatuses={siteStatuses}
        onMapReady={map => {
          mapInstanceRef.current = map;
          if (map.loaded()) setMapInstance(map);
          else map.once("load", () => setMapInstance(map));
        }}
      />
      {isWind && mapInstance && (
        <WindParticles gridData={windGrid} map={mapInstance} />
      )}

      <div className="topLegend">
        <span>Wind (km/h)</span>
        <div className="legendGradient">
          {[0, 10, 20, 30, 40, 50, 60, 70, "80+"].map(v => <b key={v}>{v}</b>)}
        </div>
      </div>

      <div className="altitudeControl">
        <span>Altitude</span>
        {ALTITUDES.map(alt => (
          <button
            key={alt}
            className={mapState.altitudeM === alt ? "selected" : ""}
            onClick={() => onMapStateChange({ altitudeM: alt })}
          >
            {alt} m
          </button>
        ))}
      </div>

      <div
        className="airspaceChip"
        onClick={() => onMapStateChange({ airspaceEnabled: !mapState.airspaceEnabled })}
        style={{ cursor: "pointer" }}
      >
        Airspace <strong>{mapState.airspaceEnabled ? "ON" : "OFF"}</strong> <ChevronDown size={13} />
      </div>

      {/* Airspace zones: will be MapLibre GeoJSON layers once real data is wired */}

      <div className="mapControls">
        <button title="Reset north" onClick={() => mapInstanceRef.current?.resetNorth({ duration: 500 })}>
          <Compass size={17} />
        </button>
        <button title="Tilt 3D" onClick={() => mapInstanceRef.current?.easeTo({ pitch: 45, duration: 500 })}>3D</button>
        <button title="Flat view" onClick={() => mapInstanceRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 500 })}>2D</button>
        <button title="Zoom in"  onClick={() => mapInstanceRef.current?.zoomIn()}>+</button>
        <button title="Zoom out" onClick={() => mapInstanceRef.current?.zoomOut()}>−</button>
      </div>

      <Timeline weather={weather} forecastDays={forecastDays} onForecastDaysChange={onForecastDaysChange} />
    </main>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
const RANGE_TO_DAYS = { "1D": 1, "3D": 3, "5D": 5 };
const DAYS_TO_RANGE = { 1: "1D", 3: "3D", 5: "5D" };

function Timeline({ weather, forecastDays = 1, onForecastDaysChange }) {
  const range   = DAYS_TO_RANGE[forecastDays] ?? "1D";
  const [playing, setPlaying] = useState(false);

  const hours = weather ?? [];
  const times = hours.length
    ? hours.map(h => fmtTime(h.valid_time))
    : ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];

  const winds      = hours.map(h => Math.round(h.wind_kmh));
  const gusts      = hours.map(h => Math.round(h.gust_kmh));
  const thermals   = hours.map(h => h.thermal_strength_ms?.toFixed(1) ?? "—");
  const cloudbases = hours.map(h => h.cloudbase_msl_m);

  return (
    <section className="timelinePanel">
      <div className="timelineTop">
        <button className="dateButton">
          Today <small>{new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</small>{" "}
          <ChevronDown size={14} />
        </button>
        <button className="playButton" onClick={() => setPlaying(v => !v)}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="timeTrack">
          {(hours.length ? times.slice(0, 8) : times).map(t => <span key={t}>{t}</span>)}
          <div className="currentTime"><b>{times[0] ?? "—"}</b></div>
        </div>
        <div className="rangeButtons">
          {["1D", "3D", "5D"].map(r => (
            <button
              key={r}
              className={range === r ? "active" : ""}
              onClick={() => onForecastDaysChange?.(RANGE_TO_DAYS[r])}
            >{r}</button>
          ))}
          <button><Layers size={16} /></button>
        </div>
      </div>

      <div className="timelineRows">
        <WeatherStrip label="Wind (km/h)"    values={winds.length      ? winds      : [6,8,10,12,14,16,14,10,6,4]}   />
        <WeatherStrip label="Gusts (km/h)"   values={gusts.length      ? gusts      : [12,14,18,22,24,26,22,18,14,10]}/>
        <WeatherStrip label="Thermals (m/s)" values={thermals.length   ? thermals   : [0.6,0.9,1.4,2.2,3.0,3.2,2.4,1.6,1.0,0.6]}/>
        <WeatherStrip label="Cloud base (m)" values={cloudbases.length ? cloudbases : [800,1000,1300,1600,1900,2100,1800,1400,1000,800]}/>
      </div>
    </section>
  );
}

function WeatherStrip({ label, values }) {
  return (
    <div className="weatherStrip">
      <span>{label}</span>
      <div className="legendGradient stripGradient" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((v, i) => <b key={i}>{v}</b>)}
      </div>
    </div>
  );
}

// ─── Right Panel ─────────────────────────────────────────────────────────────
function Metric({ title, value, suffix, note, ring, icon }) {
  return (
    <div className="metricCard">
      <span>{title}</span>
      <div className="metricBody">
        {icon && <div className="metricIcon">{icon}</div>}
        <strong>{value}<small>{suffix}</small></strong>
        {ring && <div className={`ring ${ring}`} />}
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function HourlyForecast({ weather }) {
  if (!weather?.length) return null;
  return (
    <div className="miniForecast">
      <h3>Today · {new Date().toLocaleDateString([], { day: "numeric", month: "short" })}</h3>
      <div className="forecastTable">
        <div className="forecastRow head">
          <span />
          {weather.map(h => <b key={h.valid_time}>{fmtTime(h.valid_time)}</b>)}
        </div>
        <div className="forecastRow">
          <span>km/h</span>
          {weather.map(h => <b key={h.valid_time}>{Math.round(h.wind_kmh)}</b>)}
        </div>
        <div className="forecastRow">
          <span>gusts</span>
          {weather.map((h, i) => <b key={h.valid_time} className={i >= 1 ? "good" : ""}>{Math.round(h.gust_kmh)}</b>)}
        </div>
        <div className="forecastRow">
          <span>thermals</span>
          {weather.map((h, i) => <b key={h.valid_time} className={i >= 1 ? "good" : ""}>{h.thermal_strength_ms?.toFixed(1) ?? "—"}</b>)}
        </div>
        <div className="forecastRow">
          <span>cloud base</span>
          {weather.map(h => <b key={h.valid_time}>{h.cloudbase_msl_m}</b>)}
        </div>
        <div className="forecastRow">
          <span>rain mm</span>
          {weather.map(h => <b key={h.valid_time}>{h.rain_mm}</b>)}
        </div>
      </div>
    </div>
  );
}

function BlockerList({ blockers }) {
  if (!blockers?.length) return null;
  return (
    <div className="blockerList">
      {blockers.map((b, i) => (
        <div key={i} className={`blocker ${b.severity}`}>
          <AlertTriangle size={13} />
          <span>{b.message}</span>
        </div>
      ))}
    </div>
  );
}

function RightPanel({ site, onClose, pilotLevel = "intermediate", forecastDays = 1 }) {
  const [tab, setTab] = useState("Overview");

  const { data: timeline, loading: tlLoading, error: tlError } =
    useAsync(() => api.siteFlyabilityTimeline(site.id, pilotLevel, forecastDays), [site.id, pilotLevel, forecastDays]);

  const { data: weather, loading: wxLoading, error: wxError } =
    useAsync(() => api.siteWeatherHourly(site.id, forecastDays), [site.id, forecastDays]);

  const { data: briefingData, loading: brLoading, error: brError } =
    useAsync(() => api.briefing(site.id, pilotLevel), [site.id, pilotLevel]);

  const decision = timeline?.[0];
  const color    = statusColor(decision?.status);
  const fi       = decision?.flyability_score ?? 0;

  return (
    <aside className="rightPanel">
      <div className="siteTitle">
        <div>
          <h1><Star size={18} fill="currentColor" /> {site.name}</h1>
          <small>{site.region} · {site.country_code} · {site.altitude_m} m</small>
        </div>
        <button onClick={onClose}>×</button>
      </div>

      <nav className="tabs">
        {["Overview", "Forecast", "Details", "Notes"].map(t => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          {tlLoading && <Spinner />}
          {tlError   && <ErrorBanner message={`Flyability error: ${tlError}`} />}

          {decision && (
            <>
              <div className="metricGrid">
                <Metric
                  title="Flyability Score" value={fi} suffix="/100"
                  note={fi >= 75 ? "Excellent day!" : fi >= 55 ? "Good day" : "Marginal"}
                  ring={fi >= 70 ? "green" : fi >= 50 ? "yellow" : "red"}
                />
                <Metric
                  title="Risk Score" value={decision.safety_score} suffix="/100"
                  note={decision.safety_score >= 70 ? "Low risk" : decision.safety_score >= 50 ? "Moderate risk" : "High risk"}
                  ring={decision.safety_score >= 70 ? "yellow" : "red"}
                />
                <Metric title="Wind at Launch" value={Math.round(decision.wind_kmh)} suffix=" km/h"
                  note={`From ${decision.wind_direction_deg}°`} icon={<Wind size={22} />}
                />
                <Metric title="Gusts" value={Math.round(decision.gust_kmh)} suffix=" km/h"
                  icon={<Activity size={22} />}
                />
                <Metric title="Cloudbase" value={decision.cloudbase_msl_m} suffix=" m"
                  note="MSL" icon={<CloudSun size={23} />}
                />
                <Metric title="Thermals" value={decision.thermal_strength_ms?.toFixed(1) ?? "—"} suffix=" m/s"
                  icon={<Gauge size={23} />}
                />
              </div>

              <BlockerList blockers={decision.blockers} />

              <button className={`goBar ${color}`}>
                <Clock size={20} />
                <b>{decision.status.replace("_", "-")}</b>
                <span style={{ flex: 1, fontSize: 13 }}>{decision.explanation?.[0] ?? ""}</span>
                <ChevronDown size={16} />
              </button>
            </>
          )}

          {wxLoading && <Spinner />}
          {wxError   && <ErrorBanner message={`Weather error: ${wxError}`} />}
          {weather   && <HourlyForecast weather={weather} />}

          <div className="aiCard">
            <h3><BrainCircuit size={20} /> AI Flight Briefing <em>BETA</em></h3>
            {brLoading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Generating briefing…</p>}
            {brError   && <ErrorBanner message={`Briefing error: ${brError}`} />}
            {briefingData && (
              <>
                <p>{briefingData.answer}</p>
                {briefingData.safety_footer && (
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    ⚠ {briefingData.safety_footer}
                  </p>
                )}
                {briefingData.follow_up_actions?.length > 0 && (
                  <ul className="followUpList">
                    {briefingData.follow_up_actions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                )}
                <div className="confidence">
                  <span>Confidence: <b>{Math.round(briefingData.confidence * 100)}%</b></span>
                  <div><i style={{ width: `${Math.round(briefingData.confidence * 100)}%` }} /></div>
                  <strong>{Math.round(briefingData.confidence * 100)}%</strong>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {tab === "Forecast" && (
        <>
          {wxLoading && <Spinner />}
          {wxError   && <ErrorBanner message={wxError} />}
          {weather   && <HourlyForecast weather={weather} />}
          {timeline  && (
            <div className="miniForecast" style={{ marginTop: 12 }}>
              <h3>Flyability Timeline</h3>
              <div className="forecastTable">
                <div className="forecastRow head">
                  <span />
                  {timeline.map(h => <b key={h.valid_time}>{fmtTime(h.valid_time)}</b>)}
                </div>
                <div className="forecastRow">
                  <span>status</span>
                  {timeline.map(h => (
                    <b key={h.valid_time} style={{ color: `var(--${statusColor(h.status)})`, fontSize: 10 }}>
                      {h.status.replace("_", "-")}
                    </b>
                  ))}
                </div>
                <div className="forecastRow">
                  <span>fly</span>
                  {timeline.map(h => <b key={h.valid_time}>{h.flyability_score}</b>)}
                </div>
                <div className="forecastRow">
                  <span>safety</span>
                  {timeline.map(h => <b key={h.valid_time}>{h.safety_score}</b>)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "Details" && (
        <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p><b>Altitude:</b> {site.altitude_m} m</p>
          <p><b>Safe sectors:</b> {site.safe_directions?.join(", ")}</p>
          <p><b>Difficulty:</b> {site.difficulty}</p>
          {site.hazards?.length > 0   && <p><b>Hazards:</b> {site.hazards.join(" · ")}</p>}
          {site.local_rules?.length > 0 && <p><b>Rules:</b> {site.local_rules.join(" · ")}</p>}
          {decision && (
            <>
              <p><b>Wind:</b> {Math.round(decision.wind_kmh)} km/h from {decision.wind_direction_deg}° · Gusts {Math.round(decision.gust_kmh)} km/h</p>
              <p><b>Cloudbase:</b> {decision.cloudbase_msl_m} m MSL</p>
              <p><b>Thermals:</b> {decision.thermal_strength_ms?.toFixed(1) ?? "—"} m/s</p>
              <p><b>Flyability:</b> {decision.flyability_score}/100 · Safety: {decision.safety_score}/100</p>
            </>
          )}
        </div>
      )}

      {tab === "Notes" && (
        <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          <p>No notes for this site yet.</p>
        </div>
      )}
    </aside>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const { data: sites, loading, error } = useAsync(() => api.listSites(), []);
  const [activeSite, setActiveSite]     = useState(null);
  const [bestStatus, setBestStatus]     = useState(null);
  const [siteStatuses, setSiteStatuses] = useState({});
  const [mapState, setMapState]         = useMapState();
  const [searchQuery, setSearchQuery]   = useState("");
  const [forecastDays, setForecastDays] = useState(1);
  const [pilotLevel, setPilotLevel]     = useState("intermediate");

  const filteredSites = useMemo(() => {
    if (!sites?.length) return [];
    if (!searchQuery.trim()) return sites;
    const q = searchQuery.toLowerCase();
    return sites.filter(s =>
      s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)
    );
  }, [sites, searchQuery]);

  const { data: activeWeather } = useAsync(
    () => activeSite ? api.siteWeatherHourly(activeSite.id, forecastDays) : Promise.resolve([]),
    [activeSite?.id, forecastDays]
  );

  // Auto-select first site
  useEffect(() => {
    if (sites?.length && !activeSite) setActiveSite(sites[0]);
  }, [sites]);

  // Fetch flyability for all sites to color map markers
  useEffect(() => {
    if (!sites?.length) return;
    Promise.all(
      sites.map(site =>
        api.siteFlyabilityTimeline(site.id, pilotLevel)
          .then(tl => ({ id: site.id, tl }))
          .catch(() => ({ id: site.id, tl: null }))
      )
    ).then(results => {
      const statuses = {};
      results.forEach(({ id, tl }) => {
        const h = tl?.[0];
        statuses[id] = {
          status:  h?.status          ?? "UNKNOWN",
          windDeg: h?.wind_direction_deg ?? null,
          windKmh: h?.wind_kmh           ?? null,
        };
      });
      setSiteStatuses(statuses);
      if (activeSite) setBestStatus(statuses[activeSite.id]?.status ?? "UNKNOWN");
    });
  }, [sites]);

  // Update drive status when active site changes
  useEffect(() => {
    if (!activeSite || !Object.keys(siteStatuses).length) return;
    setBestStatus(siteStatuses[activeSite.id]?.status ?? "UNKNOWN");
  }, [activeSite?.id, siteStatuses]);

  if (loading) return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "#07111f", color: "#edf7ff" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Loader size={32} className="spin" />
        <span style={{ fontSize: 14, opacity: 0.7 }}>Loading launch sites…</span>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "#07111f", color: "#ff4f69" }}>
      <div style={{ textAlign: "center" }}>
        <AlertTriangle size={32} />
        <p style={{ marginTop: 10 }}>Could not reach the SkyThermal API.</p>
        <p style={{ fontSize: 12, opacity: 0.6 }}>Backend: {BASE}</p>
      </div>
    </div>
  );

  return (
    <div className="app">
      <Sidebar
        sites={filteredSites}
        activeSiteId={activeSite?.id}
        onSelectSite={setActiveSite}
        bestStatus={bestStatus}
        mapState={mapState}
        onMapStateChange={setMapState}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <MapCanvas
        sites={sites ?? []}
        activeSiteId={activeSite?.id}
        onSelectSite={setActiveSite}
        siteStatuses={siteStatuses}
        weather={activeWeather ?? []}
        mapState={mapState}
        onMapStateChange={setMapState}
        forecastDays={forecastDays}
        onForecastDaysChange={setForecastDays}
      />
      {activeSite && (
        <RightPanel site={activeSite} onClose={() => setActiveSite(null)} pilotLevel={pilotLevel} forecastDays={forecastDays} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
