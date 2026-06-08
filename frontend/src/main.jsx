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

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = e => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
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
function Sidebar({ sites, activeSiteId, onSelectSite, bestStatus, mapState, onMapStateChange, searchQuery, onSearchChange, isOpen, onClose }) {
  const driveStatus = bestStatus ?? "UNKNOWN";
  const driveColor  = statusColor(driveStatus);
  const driveCopy   = {
    GO:      "Great day ahead!\nWorth the drive.",
    MAYBE:   "Conditions marginal.\nAssess on site.",
    NO_GO:   "Unsafe today.\nStay home.",
    UNKNOWN: "Loading…",
  }[driveStatus];

  return (
    <aside className={`sidebar${isOpen ? " is-open" : ""}`}>
      <div className="brand">
        <div className="brandMark">▰</div>
        <span>SkyThermal <small style={{ fontSize: "0.55em", opacity: 0.6, fontWeight: 500 }}>RO</small></span>
      </div>

      <div className="searchBox">
        <Search size={16} />
        <input
          placeholder="Search Carpathian launch or region…"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        <kbd>⌘ K</kbd>
      </div>

      <div className="sideHeader">
        <span>Favourite sites</span>
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
      center: [25.0, 45.8],   // Romania / Carpathians
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

// ─── Phase 3: WebGL2 wind particle layer ─────────────────────────────────────
// Architecture: CPU simulation (25k particles via LUT) + GPU FBO trail accumulation.
// LUT = 128×128 screen-space wind texture rebuilt on each moveend/new data fetch.
// Trail: ping-pong RGBA8 FBOs; fade → additive draw → blit to MapLibre framebuffer.

function createWindGLLayer() {
  const N  = window.innerWidth < 768 ? 3500 : 25000;
  const LW = 128, LH = 128;  // wind LUT dimensions

  // ── GLSL shaders ──────────────────────────────────────────────────────────
  const VS_QUAD = `#version 300 es
in vec2 a_pos;out vec2 v_uv;
void main(){gl_Position=vec4(a_pos,0.,1.);v_uv=a_pos*.5+.5;}`;

  const FS_FADE = `#version 300 es
precision mediump float;
in vec2 v_uv;uniform sampler2D u_tex;out vec4 c;
void main(){c=texture(u_tex,v_uv)*.965;}`;

  const FS_BLIT = `#version 300 es
precision mediump float;
in vec2 v_uv;uniform sampler2D u_tex;out vec4 c;
void main(){c=texture(u_tex,v_uv);}`;

  const VS_PARTICLE = `#version 300 es
precision highp float;
in vec4 a_p;out float v_spd;out float v_age;
void main(){
  v_spd=a_p.z;v_age=a_p.w;
  gl_Position=vec4(a_p.x*2.-1.,1.-a_p.y*2.,0.,1.);
  gl_PointSize=4.;
}`;

  const FS_PARTICLE = `#version 300 es
precision mediump float;
in float v_spd;in float v_age;out vec4 c;
vec3 wc(float k){
  if(k<10.)return mix(vec3(.15,.48,.83),vec3(.22,.60,.86),k/10.);
  if(k<20.)return mix(vec3(.22,.60,.86),vec3(.25,.75,.77),(k-10.)/10.);
  if(k<30.)return mix(vec3(.25,.75,.77),vec3(.22,.71,.39),(k-20.)/10.);
  if(k<40.)return mix(vec3(.22,.71,.39),vec3(.86,.78,.20),(k-30.)/10.);
  if(k<50.)return mix(vec3(.86,.78,.20),vec3(.90,.47,.16),(k-40.)/10.);
  if(k<60.)return mix(vec3(.90,.47,.16),vec3(.86,.24,.28),(k-50.)/10.);
  return mix(vec3(.86,.24,.28),vec3(.45,.17,.81),clamp((k-60.)/20.,0.,1.));
}
void main(){
  vec2 cxy=2.*gl_PointCoord-1.;
  if(dot(cxy,cxy)>1.)discard;
  float a=min(.9,v_age/15.)*max(.15,min(1.,v_spd/20.))*(1.-length(cxy));
  vec3 col=wc(v_spd);
  c=vec4(col*a,a);
}`;

  // ── GL resources ──────────────────────────────────────────────────────────
  let _gl, _map;
  let _quadBuf, _particleBuf;
  let _progFade, _progBlit, _progParticle;
  let _trailA, _trailB, _fboA, _fboB;
  let _trailW = 0, _trailH = 0;

  // ── CPU particle state ────────────────────────────────────────────────────
  const _pdata = new Float32Array(N * 4);   // x, y, speed_kmh, age_ratio per particle
  const _px    = new Float32Array(N);
  const _py    = new Float32Array(N);
  const _pa    = new Float32Array(N);       // age
  const _pma   = new Float32Array(N);       // maxAge
  const _ps    = new Float32Array(N);       // speed km/h

  for (let i = 0; i < N; i++) {
    _px[i] = Math.random(); _py[i] = Math.random();
    _pa[i] = Math.floor(Math.random() * 80);
    _pma[i] = 60 + Math.floor(Math.random() * 80);
    _ps[i] = 15;
  }

  // ── Wind LUT (screen-space, rebuilt on moveend + new data) ────────────────
  let _lut_u = null, _lut_v = null, _lut_s = null, _lut_ok = null;
  let _lastGrid = null;
  let _pendingUpdate = null;  // { gridData, map } queued before onAdd

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _mkShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("[WindGL] shader:", gl.getShaderInfoLog(s));
      gl.deleteShader(s); return null;
    }
    return s;
  }

  function _mkProg(gl, vs, fs) {
    const p = gl.createProgram();
    const v = _mkShader(gl, gl.VERTEX_SHADER, vs);
    const f = _mkShader(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("[WindGL] link:", gl.getProgramInfoLog(p)); return null;
    }
    return p;
  }

  function _mkTex(gl, w, h, data = null) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  function _mkFBO(gl, tex) {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return f;
  }

  function _ensureTrail(gl, w, h) {
    if (_trailW === w && _trailH === h) return;
    if (_trailA) gl.deleteTexture(_trailA);
    if (_trailB) gl.deleteTexture(_trailB);
    if (_fboA)   gl.deleteFramebuffer(_fboA);
    if (_fboB)   gl.deleteFramebuffer(_fboB);
    _trailA = _mkTex(gl, w, h); _trailB = _mkTex(gl, w, h);
    _fboA = _mkFBO(gl, _trailA); _fboB = _mkFBO(gl, _trailB);
    _trailW = w; _trailH = h;
  }

  function _buildLUT(map) {
    if (!_lastGrid) { _lut_ok = null; return; }
    const mc = map.getCanvas();
    const W  = mc.offsetWidth, H = mc.offsetHeight;
    if (!W || !H) return;
    _lut_u = new Float32Array(LW * LH);
    _lut_v = new Float32Array(LW * LH);
    _lut_s = new Float32Array(LW * LH);
    _lut_ok = new Uint8Array(LW * LH);
    for (let y = 0; y < LH; y++) {
      for (let x = 0; x < LW; x++) {
        const ll = map.unproject([x * W / LW, y * H / LH]);
        const w  = interpWind(ll.lng, ll.lat, _lastGrid);
        const i  = y * LW + x;
        if (w) { _lut_u[i] = w.u; _lut_v[i] = w.v; _lut_s[i] = w.speed; _lut_ok[i] = 1; }
      }
    }
  }

  function _sampleLUT(xn, yn) {
    if (!_lut_ok) return null;
    const xi = Math.min(LW - 1, Math.floor(xn * LW));
    const yi = Math.min(LH - 1, Math.floor(yn * LH));
    const i  = yi * LW + xi;
    if (!_lut_ok[i]) return null;
    return { u: _lut_u[i], v: _lut_v[i], s: _lut_s[i] };
  }

  function _synWind(x, y) {
    const a = Math.sin(y * 25.13) * 1.2 + Math.cos(x * 18.85) * 1.8;
    const m = 0.7 + Math.sin((x + y) * 15.71) * 0.5;
    return { u: Math.cos(a) * m * 5, v: Math.sin(a) * m * 5, s: m * 18 };
  }

  function _cpuUpdate(zoom, W, H) {
    const pxF = 1.8 * Math.pow(2, (zoom - 8) * 0.3);
    const ux  = pxF / W, uy = pxF / H;
    let j = 0;
    for (let i = 0; i < N; i++) {
      const x = _px[i], y = _py[i];
      const w = _sampleLUT(x, y) ?? _synWind(x, y);
      const nx = x + w.u * ux;
      const ny = y - w.v * uy;
      _pa[i]++;
      if (_pa[i] > _pma[i] || nx < 0 || nx > 1 || ny < 0 || ny > 1) {
        _px[i] = Math.random(); _py[i] = Math.random();
        _pa[i] = 0; _pma[i] = 60 + Math.floor(Math.random() * 80); _ps[i] = 15;
      } else {
        _px[i] = nx; _py[i] = ny; _ps[i] = w.s;
      }
      _pdata[j++] = _px[i]; _pdata[j++] = _py[i];
      _pdata[j++] = _ps[i]; _pdata[j++] = Math.min(1, _pa[i] / 15);
    }
  }

  function _blitQuad(gl, prog, tex) {
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, "u_tex"), 0);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.bindBuffer(gl.ARRAY_BUFFER, _quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(loc);
  }

  // ── MapLibre custom layer API ──────────────────────────────────────────────
  return {
    id: "wind-gl",
    type: "custom",
    renderingMode: "2d",

    onAdd(m, g) {
      _map = m; _gl = g;
      _progFade     = _mkProg(g, VS_QUAD,     FS_FADE);
      _progBlit     = _mkProg(g, VS_QUAD,     FS_BLIT);
      _progParticle = _mkProg(g, VS_PARTICLE, FS_PARTICLE);
      if (!_progFade || !_progBlit || !_progParticle) return;

      _quadBuf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, _quadBuf);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), g.STATIC_DRAW);

      _particleBuf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, null);

      if (_pendingUpdate) {
        this.updateWind(_pendingUpdate.gridData, _pendingUpdate.map);
        _pendingUpdate = null;
      }
    },

    render(g, _matrix) {
      if (!_progFade || !_particleBuf) return;
      const mc = _map.getCanvas();
      const W  = mc.width, H = mc.height;
      if (!W || !H) return;
      _ensureTrail(g, W, H);

      const prevFBO = g.getParameter(g.FRAMEBUFFER_BINDING);
      g.disable(g.DEPTH_TEST);
      g.disable(g.STENCIL_TEST);

      // 1. CPU update
      _cpuUpdate(_map.getZoom(), W, H);

      // 2. Upload particle data to GPU
      g.bindBuffer(g.ARRAY_BUFFER, _particleBuf);
      g.bufferData(g.ARRAY_BUFFER, _pdata, g.DYNAMIC_DRAW);
      g.bindBuffer(g.ARRAY_BUFFER, null);

      // 3. Fade trail (trailA → trailB × 0.93)
      g.bindFramebuffer(g.FRAMEBUFFER, _fboB);
      g.viewport(0, 0, W, H);
      g.disable(g.BLEND);
      _blitQuad(g, _progFade, _trailA);

      // 4. Draw new particles to trailB (additive)
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      g.useProgram(_progParticle);
      const pLoc = g.getAttribLocation(_progParticle, "a_p");
      g.bindBuffer(g.ARRAY_BUFFER, _particleBuf);
      g.enableVertexAttribArray(pLoc);
      g.vertexAttribPointer(pLoc, 4, g.FLOAT, false, 0, 0);
      g.drawArrays(g.POINTS, 0, N);
      g.disableVertexAttribArray(pLoc);
      g.bindBuffer(g.ARRAY_BUFFER, null);
      g.disable(g.BLEND);

      // 5. Blit trailB to screen (additive glow on map)
      g.bindFramebuffer(g.FRAMEBUFFER, prevFBO);
      g.viewport(0, 0, W, H);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      _blitQuad(g, _progBlit, _trailB);
      g.disable(g.BLEND);

      // 6. Restore MapLibre state
      g.enable(g.DEPTH_TEST);

      // 7. Swap trail ping-pong
      [_trailA, _trailB] = [_trailB, _trailA];
      [_fboA,   _fboB]   = [_fboB,   _fboA];

      _map.triggerRepaint();
    },

    onRemove(_m, g) {
      [_trailA, _trailB].forEach(t => t && g.deleteTexture(t));
      [_fboA,   _fboB].forEach(f => f && g.deleteFramebuffer(f));
      if (_quadBuf)     g.deleteBuffer(_quadBuf);
      if (_particleBuf) g.deleteBuffer(_particleBuf);
      [_progFade, _progBlit, _progParticle].forEach(p => p && g.deleteProgram(p));
    },

    // Called when new wind grid data arrives or map view changes
    updateWind(gridData, map) {
      if (!_gl) { _pendingUpdate = { gridData, map }; return; }
      _lastGrid = gridData?.grid?.length ? buildWindGrid(gridData.grid) : null;
      if (map) _buildLUT(map);
    },

    // Rebuild screen-space LUT after map pan/zoom (same data, new projection)
    rebuildLUT(map) {
      if (_gl) _buildLUT(map);
    },
  };
}

function WindParticlesGL({ gridData, map }) {
  const layerRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const layer = createWindGLLayer();
    layerRef.current = layer;
    try {
      map.addLayer(layer);
    } catch (e) {
      console.error("[WindGL] addLayer failed:", e);
      return;
    }
    const onView = () => layerRef.current?.rebuildLUT(map);
    map.on("moveend", onView);
    map.on("zoomend", onView);
    return () => {
      map.off("moveend", onView);
      map.off("zoomend", onView);
      layerRef.current = null;
      try { if (map.getLayer("wind-gl")) map.removeLayer("wind-gl"); } catch (_) {}
    };
  }, [map]);

  useEffect(() => {
    if (layerRef.current && map) layerRef.current.updateWind(gridData, map);
  }, [gridData, map]);

  return null;
}

// ─── Weather raster overlay controller ───────────────────────────────────────
// Adds colored raster tiles for non-wind overlays. Tiles 404 until backend
// implements /v1/tiles/{overlay}/{z}/{x}/{y}.png — MapLibre shows nothing gracefully.
function WeatherOverlayController({ map, overlay, altitudeM }) {
  useEffect(() => {
    if (!map) return;
    const SRC_ID = "wx-raster-src";
    const LYR_ID = "wx-raster-layer";
    const cleanup = () => {
      try { if (map.getLayer(LYR_ID)) map.removeLayer(LYR_ID); } catch (_) {}
      try { if (map.getSource(SRC_ID)) map.removeSource(SRC_ID); } catch (_) {}
    };
    cleanup();
    if (!WIND_OVERLAYS.has(overlay)) {
      try {
        map.addSource(SRC_ID, {
          type: "raster",
          tiles: [`${BASE}/v1/tiles/${overlay}/{z}/{x}/{y}.png?altitude_m=${altitudeM}`],
          tileSize: 256,
        });
        const before = map.getLayer("wind-gl") ? "wind-gl" : undefined;
        map.addLayer({
          id: LYR_ID, type: "raster", source: SRC_ID,
          paint: { "raster-opacity": 0.72, "raster-fade-duration": 250 },
        }, before);
      } catch (_) {}
    }
    return cleanup;
  }, [map, overlay, altitudeM]);
  return null;
}

// ─── Map Canvas (overlays + timeline) ────────────────────────────────────────
function MapCanvas({ sites, activeSiteId, onSelectSite, siteStatuses, weather, mapState, onMapStateChange, forecastDays, onForecastDaysChange, onOpenSidebar }) {
  const mapInstanceRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [windGrid,    setWindGrid]    = useState(null);
  const ALTITUDES = [0, 500, 1000, 1500, 2000, 3000];
  const ALT_LABEL = { 0: "Surface", 500: "500 m", 1000: "1000 m", 1500: "1500 m", 2000: "2000 m", 3000: "3000 m" };
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
        <WindParticlesGL gridData={windGrid} map={mapInstance} />
      )}
      {mapInstance && (
        <WeatherOverlayController map={mapInstance} overlay={mapState.overlay} altitudeM={mapState.altitudeM} />
      )}

      {/* Mobile: floating search pill */}
      <button className="mobileSearchPill" onClick={onOpenSidebar}>
        <Search size={16} />
        <span>Search launch site…</span>
      </button>

      {/* Mobile: floating layers FAB */}
      <button className="mobileLayerFab" onClick={onOpenSidebar}>
        <Layers size={20} />
        <span>Layers</span>
      </button>

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
            {ALT_LABEL[alt]}
          </button>
        ))}
      </div>

      <div
        className="airspaceChip"
        onClick={() => onMapStateChange({ airspaceEnabled: !mapState.airspaceEnabled })}
        style={{ cursor: "pointer" }}
      >
        ROMATSA / Airspace <strong>{mapState.airspaceEnabled ? "ON" : "OFF"}</strong> <ChevronDown size={13} />
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
  const [sidebarOpen, setSidebarOpen]   = useState(false);

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
      {sidebarOpen && (
        <div className="sidebarBackdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        sites={filteredSites}
        activeSiteId={activeSite?.id}
        onSelectSite={site => { setActiveSite(site); setSidebarOpen(false); }}
        bestStatus={bestStatus}
        mapState={mapState}
        onMapStateChange={setMapState}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
        onOpenSidebar={() => setSidebarOpen(true)}
      />
      {activeSite && (
        <RightPanel site={activeSite} onClose={() => setActiveSite(null)} pilotLevel={pilotLevel} forecastDays={forecastDays} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
