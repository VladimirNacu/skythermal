import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Search, Star, Plus, Wind, CloudSun, CloudRain, Zap, Eye,
  Thermometer, Mountain, Gauge, Car, Navigation, Layers,
  Crosshair, Maximize, Ruler, Play, Pause, ChevronDown,
  MapPin, Plane, BrainCircuit, Clock, ShieldAlert, Cloud, Activity,
  AlertTriangle, Loader, Compass, LogIn, LogOut, UserCircle, Settings
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

  windGrid: (minLat, maxLat, minLon, maxLon, step, altitudeM = 0, time = null) => {
    const p = new URLSearchParams({
      min_lat: minLat.toFixed(2), max_lat: maxLat.toFixed(2),
      min_lon: minLon.toFixed(2), max_lon: maxLon.toFixed(2),
      step:    step.toFixed(2),   altitude_m: altitudeM,
    });
    if (time) p.set("time", time);
    return fetch(`${BASE}/v1/weather/wind-grid?${p}`).then(r => r.json());
  },

  createSite: (body) =>
    fetch(`${BASE}/v1/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),

  register: (email, password, display_name) =>
    fetch(`${BASE}/v1/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, display_name }),
    }).then(r => r.json()),

  login: (email, password) =>
    fetch(`${BASE}/v1/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json()),

  me: (token) =>
    fetch(`${BASE}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),

  getFavorites: (token) =>
    fetch(`${BASE}/v1/users/me/favorites`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),

  addFavorite: (token, site_id, site_data) =>
    fetch(`${BASE}/v1/users/me/favorites`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ site_id, site_data }),
    }).then(r => r.json()),

  removeFavorite: (token, site_id) =>
    fetch(`${BASE}/v1/users/me/favorites/${encodeURIComponent(site_id)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()),

  getSettings: (token) =>
    fetch(`${BASE}/v1/users/me/settings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),

  saveSettings: (token, settings) =>
    fetch(`${BASE}/v1/users/me/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    }).then(r => r.json()),

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
  layers: [{
    id: "carto-dark", type: "raster", source: "carto",
    paint: {
      "raster-brightness-min": 0.18,
      "raster-contrast": 0.18,
      "raster-saturation": -0.15,
    },
  }],
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

// Country → IANA timezone
const CC_TZ = {
  RO: "Europe/Bucharest", NO: "Europe/Oslo",   FR: "Europe/Paris",
  DE: "Europe/Berlin",    AT: "Europe/Vienna",  CH: "Europe/Zurich",
  IT: "Europe/Rome",      ES: "Europe/Madrid",  GB: "Europe/London",
  TR: "Europe/Istanbul",  US: "America/New_York",
};

function siteTimezone(site) {
  return CC_TZ[site?.country_code] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function fmtTime(isoString, tz) {
  return new Date(isoString).toLocaleTimeString("en", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    ...(tz ? { timeZone: tz } : {}),
  });
}

function fmtDayLabel(isoString, tz) {
  return new Date(isoString).toLocaleDateString("en", {
    weekday: "short", day: "numeric", month: "short",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function localDateKey(isoString, tz) {
  return new Date(isoString).toLocaleDateString("en", {
    year: "numeric", month: "2-digit", day: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
}

function tzAbbr(tz) {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? tz;
  } catch { return tz; }
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

function nowHourISO() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 13) + ":00:00Z";
}

function useMapState() {
  const [state, setState] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      overlay:         p.get("overlay")  ?? "altitude_wind",
      altitudeM:       Number(p.get("altitude")) || 1000,
      forecastModel:   p.get("model")    ?? "auto_best",
      airspaceEnabled: p.get("airspace") !== "false",
      selectedTime:    p.get("time")     ?? nowHourISO(),
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
      p.set("time",     next.selectedTime);
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

// ─── Auth hook ────────────────────────────────────────────────────────────────
function useAuth() {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("st_token"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) { setReady(true); return; }
    api.me(token).then(u => {
      if (u) setUser(u); else { setToken(null); localStorage.removeItem("st_token"); }
      setReady(true);
    });
  }, []);

  const signIn = useCallback((userData, tok) => {
    localStorage.setItem("st_token", tok);
    setToken(tok); setUser(userData);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("st_token");
    setToken(null); setUser(null);
  }, []);

  return { user, token, ready, signIn, signOut };
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSignIn }) {
  const [tab,     setTab]     = useState("login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState(null);

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const result = tab === "login"
      ? await api.login(email, pass)
      : await api.register(email, pass, name || undefined);
    setLoading(false);
    if (result.detail) { setErr(result.detail); return; }
    if (!result.token) { setErr("Unexpected error"); return; }
    onSignIn(result.user, result.token);
    onClose();
  }

  return (
    <div className="modalOverlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modalBox">
        <div className="modalHeader">
          <span>{tab === "login" ? "Sign in" : "Create account"}</span>
          <button className="iconButton small" onClick={onClose}>✕</button>
        </div>
        <div className="authTabs">
          <button className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Sign in</button>
          <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Register</button>
        </div>
        <form className="modalForm" onSubmit={submit}>
          {tab === "register" && (
            <label>Display name
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>Email
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label>Password
            <input required type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={tab === "register" ? "Min. 6 characters" : "Password"} minLength={6} />
          </label>
          {err && <p className="modalError">{typeof err === "string" ? err : JSON.stringify(err)}</p>}
          <div className="modalActions">
            <button type="button" className="btnSecondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btnPrimary" disabled={loading}>
              {loading ? "…" : tab === "login" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Site Modal ───────────────────────────────────────────────────────────
function AddSiteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "", lat: "", lon: "", altitude_m: "", region: "",
    country_code: "RO", difficulty: "intermediate", safe_directions: "",
  });
  const [saving,   setSaving]   = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr]           = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function useGPS() {
    if (!navigator.geolocation) { setErr("GPS not available in this browser"); return; }
    setLocating(true); setErr(null);
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setForm(f => ({ ...f, lat: lat.toFixed(6), lon: lon.toFixed(6) }));
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
          { headers: { "Accept-Language": "en" } }
        ).then(r => r.json());
        const a = r.address ?? {};
        const region = a.county || a.state || a.region || a.city || "";
        const cc = (a.country_code || "").toUpperCase();
        setForm(f => ({
          ...f,
          region:       f.region       || region,
          country_code: f.country_code === "RO" && cc ? cc : f.country_code,
        }));
      } catch (_) {}
      setLocating(false);
    }, err => {
      setErr(err.code === 1 ? "Location permission denied" : "Could not get location");
      setLocating(false);
    }, { timeout: 10000 });
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const site = await api.createSite({
        name:            form.name.trim(),
        lat:             parseFloat(form.lat),
        lon:             parseFloat(form.lon),
        altitude_m:      parseInt(form.altitude_m, 10),
        region:          form.region.trim(),
        country_code:    form.country_code.trim().toUpperCase(),
        difficulty:      form.difficulty,
        safe_directions: form.safe_directions.split(",").map(s => s.trim()).filter(Boolean),
      });
      onCreated(site);
      onClose();
    } catch (ex) {
      setErr(ex.message || "Failed to create site");
      setSaving(false);
    }
  }

  return (
    <div className="modalOverlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modalBox">
        <div className="modalHeader">
          <span>Add launch site</span>
          <button className="iconButton small" onClick={onClose}>✕</button>
        </div>
        <form className="modalForm" onSubmit={submit}>
          <label>Site name
            <input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Bunloc" />
          </label>
          <button type="button" className="gpsBtn" onClick={useGPS} disabled={locating}>
            <Crosshair size={15} />
            {locating ? "Getting location…" : "Use my GPS location"}
          </button>
          <div className="modalRow">
            <label>Latitude
              <input required type="number" step="any" value={form.lat} onChange={e => set("lat", e.target.value)} placeholder="45.638" />
            </label>
            <label>Longitude
              <input required type="number" step="any" value={form.lon} onChange={e => set("lon", e.target.value)} placeholder="25.678" />
            </label>
          </div>
          <div className="modalRow">
            <label>Altitude (m)
              <input required type="number" value={form.altitude_m} onChange={e => set("altitude_m", e.target.value)} placeholder="950" />
            </label>
            <label>Country code
              <input required maxLength={3} value={form.country_code} onChange={e => set("country_code", e.target.value)} placeholder="RO" />
            </label>
          </div>
          <label>Region
            <input required value={form.region} onChange={e => set("region", e.target.value)} placeholder="Transylvania" />
          </label>
          <label>Difficulty
            <select value={form.difficulty} onChange={e => set("difficulty", e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>Safe wind directions (comma-separated)
            <input value={form.safe_directions} onChange={e => set("safe_directions", e.target.value)} placeholder="N, NW, W" />
          </label>
          {err && <p className="modalError">{err}</p>}
          <div className="modalActions">
            <button type="button" className="btnSecondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btnPrimary" disabled={saving}>
              {saving ? "Saving…" : "Add site"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ sites, activeSiteId, onSelectSite, bestStatus, mapState, onMapStateChange, searchQuery, onSearchChange, isOpen, onClose, onAddSite, user, onSignIn, onSignOut, favoriteSiteIds, onToggleFavorite }) {
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
        {user ? (
          <div className="userChip" title={user.email}>
            <UserCircle size={16} />
            <span>{user.display_name || user.email.split("@")[0]}</span>
            <button className="iconButton small" onClick={onSignOut} title="Sign out"><LogOut size={13} /></button>
          </div>
        ) : (
          <button className="iconButton small" onClick={onSignIn} title="Sign in"><LogIn size={16} /></button>
        )}
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
        <button className="iconButton small" onClick={onAddSite} title="Add new site"><Plus size={15} /></button>
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
            <Star
              size={14}
              className={favoriteSiteIds?.has(site.id) ? "starOn" : ""}
              onClick={e => { e.stopPropagation(); onToggleFavorite?.(site); }}
              style={{ cursor: user ? "pointer" : "default", opacity: user ? 1 : 0.3 }}
            />
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
  const pinColor  = statusHex(status);   // always green/red/yellow/grey — blue only for active ring
  const arrowColor = isActive ? "#2f9bff" : pinColor;
  const blowTo = windDeg != null ? (windDeg + 180) % 360 : 0;

  const el = document.createElement("div");
  el.className = "ml-marker" + (isActive ? " is-active" : "");

  const windHtml = windDeg != null ? `
    <div class="ml-wind">
      <svg width="16" height="16" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${blowTo},11,11)">
          <line x1="11" y1="17" x2="11" y2="4" stroke="${arrowColor}" stroke-width="2.5" stroke-linecap="round"/>
          <polygon points="11,1 6.5,8.5 15.5,8.5" fill="${arrowColor}"/>
        </g>
      </svg>
      <span class="ml-wind-spd" style="color:${arrowColor}">${windKmh}</span>
    </div>` : "";

  el.innerHTML = `
    ${windHtml}
    <div class="ml-pin" style="background:${pinColor}">
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="white">
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
void main(){c=texture(u_tex,v_uv)*.975;}`;

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
  gl_PointSize=7.;
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
  float a=min(1.,v_age/8.)*max(.52,min(1.,v_spd/15.))*(1.-length(cxy)*.7);
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
    // Use CSS pixels (offsetWidth/Height) — map.unproject() takes CSS pixel coordinates.
    // Keep consistent with _cpuUpdate which divides by the same CSS dimensions.
    const dpr = window.devicePixelRatio || 1;
    const W  = mc.width / dpr, H = mc.height / dpr;
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
      if (!_lastGrid) return;  // wait for real wind data — no synWind spirals
      const mc  = _map.getCanvas();
      const W   = mc.width, H = mc.height;       // physical pixels — for FBO/viewport
      if (!W || !H) return;
      _ensureTrail(g, W, H);
      const dpr = window.devicePixelRatio || 1;
      const Wc  = W / dpr, Hc = H / dpr;         // CSS pixels — for LUT & velocity scaling

      const prevFBO = g.getParameter(g.FRAMEBUFFER_BINDING);
      g.disable(g.DEPTH_TEST);
      g.disable(g.STENCIL_TEST);

      // 1. CPU update (use CSS pixel dimensions for geo→screen velocity scaling)
      _cpuUpdate(_map.getZoom(), Wc, Hc);

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

    // Called when new wind grid data arrives or map view changes.
    // gridData===null means overlay switched away from wind → clear.
    // gridData with empty grid means fetch failed → keep existing grid so
    // particles don't vanish while waiting for a retry.
    updateWind(gridData, map) {
      if (!_gl) { _pendingUpdate = { gridData, map }; return; }
      if (gridData === null) {
        _lastGrid = null;
      } else if (gridData?.grid?.length) {
        _lastGrid = buildWindGrid(gridData.grid);
      }
      // empty grid (failed/429) → keep _lastGrid as-is
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
    map.on("resize",  onView);   // rebuild LUT when canvas dimensions change
    return () => {
      map.off("moveend", onView);
      map.off("zoomend", onView);
      map.off("resize",  onView);
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
// Always adds a coloured raster tile:
//  • wind overlays  → wind-speed colour field (particles animate on top)
//  • other overlays → data field (thermals, rain, temperature, etc.)
function WeatherOverlayController({ map, overlay, altitudeM, selectedTime }) {
  useEffect(() => {
    if (!map) return;
    const SRC_ID = "wx-raster-src";
    const LYR_ID = "wx-raster-layer";
    const cleanup = () => {
      try { if (map.getLayer(LYR_ID)) map.removeLayer(LYR_ID); } catch (_) {}
      try { if (map.getSource(SRC_ID)) map.removeSource(SRC_ID); } catch (_) {}
    };
    cleanup();
    try {
      const t = encodeURIComponent(selectedTime ?? nowHourISO());
      map.addSource(SRC_ID, {
        type: "raster",
        tiles: [`${BASE}/v1/tiles/${overlay}/{z}/{x}/{y}.png?altitude_m=${altitudeM}&time=${t}`],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 10,
      });
      // Insert BELOW "wind-gl" so particles always render on top
      const before = map.getLayer("wind-gl") ? "wind-gl" : undefined;
      map.addLayer({
        id: LYR_ID, type: "raster", source: SRC_ID,
        paint: { "raster-opacity": 0.80, "raster-fade-duration": 300 },
      }, before);
    } catch (_) {}
    return cleanup;
  }, [map, overlay, altitudeM, selectedTime]);
  return null;
}

// ─── Map Canvas (overlays + timeline) ────────────────────────────────────────
function MapCanvas({ sites, activeSiteId, onSelectSite, siteStatuses, weather, mapState, onMapStateChange, forecastDays, onForecastDaysChange, onOpenSidebar, activeSite }) {
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
            step, altM, mapState.selectedTime,
          );
          setWindGrid(data);
        } catch (e) {
          console.error("wind-grid fetch failed:", e);
        }
      }, 300);
    };

    mapInstance.on("moveend", refresh);
    mapInstance.on("zoomend", refresh);
    mapInstance.on("resize",  refresh);
    refresh();
    return () => {
      clearTimeout(tid);
      mapInstance.off("moveend", refresh);
      mapInstance.off("zoomend", refresh);
      mapInstance.off("resize",  refresh);
    };
  }, [isWind, mapInstance, mapState.overlay, mapState.altitudeM, mapState.selectedTime]);

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
        <WeatherOverlayController
          map={mapInstance}
          overlay={mapState.overlay}
          altitudeM={mapState.altitudeM}
          selectedTime={mapState.selectedTime}
        />
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

      <Timeline
        weather={weather}
        forecastDays={forecastDays}
        onForecastDaysChange={onForecastDaysChange}
        selectedTime={mapState.selectedTime}
        onTimeChange={t => onMapStateChange({ selectedTime: t })}
        site={activeSite}
      />
    </main>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
const RANGE_TO_DAYS = { "1D": 1, "3D": 3, "5D": 5 };
const DAYS_TO_RANGE = { 1: "1D", 3: "3D", 5: "5D" };

function Timeline({ weather, forecastDays = 1, onForecastDaysChange, selectedTime, onTimeChange, site }) {
  const range   = DAYS_TO_RANGE[forecastDays] ?? "1D";
  const [playing, setPlaying] = useState(false);
  const tz = siteTimezone(site);

  const hours = weather ?? [];
  const selectedPrefix = (selectedTime ?? "").slice(0, 13); // "2026-06-07T11"

  const winds      = hours.map(h => Math.round(h.wind_kmh));
  const gusts      = hours.map(h => Math.round(h.gust_kmh));
  const thermals   = hours.map(h => h.thermal_strength_ms?.toFixed(1) ?? "—");
  const cloudbases = hours.map(h => h.cloudbase_msl_m);

  const displayHours = hours.length
    ? hours.slice(0, 8)
    : Array.from({ length: 8 }, (_, i) => ({ valid_time: null, _label: `${String(i * 3).padStart(2,"0")}:00` }));

  return (
    <section className="timelinePanel">
      <div className="timelineTop">
        <button className="dateButton">
          Today <small>{new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}</small>{" "}
          <small style={{ fontSize: "0.75em", opacity: 0.45 }}>{tzAbbr(tz)}</small>
          <ChevronDown size={14} />
        </button>
        <button className="playButton" onClick={() => setPlaying(v => !v)}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="timeTrack">
          {displayHours.map((h, i) => {
            const label    = h.valid_time ? fmtTime(h.valid_time, tz) : (h._label ?? "");
            const isActive = h.valid_time && h.valid_time.slice(0, 13) === selectedPrefix;
            return (
              <span
                key={i}
                className={isActive ? "active" : ""}
                style={{ cursor: h.valid_time ? "pointer" : "default" }}
                onClick={() => h.valid_time && onTimeChange?.(
                  h.valid_time.slice(0, 13) + ":00:00Z"
                )}
              >
                {label}
              </span>
            );
          })}
          <div className="currentTime">
            <b>{displayHours.find(h => h.valid_time?.slice(0,13) === selectedPrefix)
                ? fmtTime(selectedTime, tz)
                : (displayHours[0]?.valid_time ? fmtTime(displayHours[0].valid_time, tz) : "—")}</b>
          </div>
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

function HourlyForecast({ weather, site }) {
  if (!weather?.length) return null;
  const tz = siteTimezone(site);

  // Group hours by local date
  const days = [];
  let cur = null;
  for (const h of weather) {
    const key = localDateKey(h.valid_time, tz);
    if (!cur || cur.key !== key) {
      cur = { key, label: fmtDayLabel(h.valid_time, tz), hours: [] };
      days.push(cur);
    }
    cur.hours.push(h);
  }

  return (
    <div className="miniForecast">
      <h3 style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <span>Hourly Forecast</span>
        <small style={{ fontSize: 11, opacity: 0.55, fontWeight: 400 }}>{tzAbbr(tz)}</small>
      </h3>
      {days.map(day => (
        <div key={day.key} style={{ marginBottom: 10 }}>
          <div className="forecastDayHeader">{day.label}</div>
          <div className="forecastTable">
            <div className="forecastRow head">
              <span />
              {day.hours.map(h => <b key={h.valid_time}>{fmtTime(h.valid_time, tz)}</b>)}
            </div>
            <div className="forecastRow">
              <span>wind km/h</span>
              {day.hours.map(h => <b key={h.valid_time}>{Math.round(h.wind_kmh)}</b>)}
            </div>
            <div className="forecastRow">
              <span>gusts</span>
              {day.hours.map(h => <b key={h.valid_time}>{Math.round(h.gust_kmh)}</b>)}
            </div>
            <div className="forecastRow">
              <span>thermals</span>
              {day.hours.map(h => <b key={h.valid_time}>{h.thermal_strength_ms?.toFixed(1) ?? "—"}</b>)}
            </div>
            <div className="forecastRow">
              <span>cloud base</span>
              {day.hours.map(h => <b key={h.valid_time}>{h.cloudbase_msl_m}</b>)}
            </div>
            <div className="forecastRow">
              <span>rain mm</span>
              {day.hours.map(h => <b key={h.valid_time}>{h.rain_mm}</b>)}
            </div>
          </div>
        </div>
      ))}
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
  const [tab, setTab]                       = useState("Overview");
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const { data: timeline, loading: tlLoading, error: tlError } =
    useAsync(() => api.siteFlyabilityTimeline(site.id, pilotLevel, forecastDays), [site.id, pilotLevel, forecastDays]);

  const { data: weather, loading: wxLoading, error: wxError } =
    useAsync(() => api.siteWeatherHourly(site.id, forecastDays), [site.id, forecastDays]);

  const { data: briefingData, loading: brLoading, error: brError } =
    useAsync(() => api.briefing(site.id, pilotLevel), [site.id, pilotLevel]);

  const decision = timeline?.[0];
  const color    = statusColor(decision?.status);
  const fi       = decision?.flyability_score ?? 0;

  const panelClass = isMobile
    ? `rightPanel ${mobilePanelExpanded ? "expanded" : "collapsed"}`
    : "rightPanel";

  return (
    <aside className={panelClass}>
      {isMobile && (
        <button
          className="sheetHandle"
          onClick={() => setMobilePanelExpanded(v => !v)}
          aria-label={mobilePanelExpanded ? "Collapse site panel" : "Expand site panel"}
        />
      )}
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
          {weather   && <HourlyForecast weather={weather} site={site} />}

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
          {weather   && <HourlyForecast weather={weather} site={site} />}
          {timeline  && (
            <div className="miniForecast" style={{ marginTop: 12 }}>
              <h3>Flyability Timeline</h3>
              <div className="forecastTable">
                <div className="forecastRow head">
                  <span />
                  {timeline.map(h => <b key={h.valid_time}>{fmtTime(h.valid_time, siteTimezone(site))}</b>)}
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
  const { user, token, ready: authReady, signIn, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { data: sites, loading, error } = useAsync(() => api.listSites(), []);
  const [activeSite, setActiveSite]     = useState(null);
  const [bestStatus, setBestStatus]     = useState(null);
  const [siteStatuses, setSiteStatuses] = useState({});
  const [mapState, setMapState]         = useMapState();
  const [searchQuery, setSearchQuery]   = useState("");
  const [forecastDays, setForecastDays] = useState(1);
  const [pilotLevel, setPilotLevel]     = useState("intermediate");
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [showAddSite, setShowAddSite]   = useState(false);
  const [extraSites, setExtraSites]     = useState([]);
  const [favoriteSiteIds, setFavoriteSiteIds] = useState(new Set());

  // Load favorites + settings when user logs in
  useEffect(() => {
    if (!user || !token) { setFavoriteSiteIds(new Set()); return; }
    api.getFavorites(token).then(favs => {
      setFavoriteSiteIds(new Set(favs.map(f => f.site_id)));
    }).catch(() => {});
    api.getSettings(token).then(s => {
      if (s.pilot_level)       setPilotLevel(s.pilot_level);
      if (s.default_overlay)   setMapState({ overlay: s.default_overlay });
      if (s.default_altitude_m !== undefined) setMapState({ altitudeM: s.default_altitude_m });
    }).catch(() => {});
  }, [user?.id]);

  // Save settings debounced when they change
  const settingsSaveRef = useRef(null);
  useEffect(() => {
    if (!token) return;
    clearTimeout(settingsSaveRef.current);
    settingsSaveRef.current = setTimeout(() => {
      api.saveSettings(token, {
        pilot_level: pilotLevel,
        default_overlay: mapState.overlay,
        default_altitude_m: mapState.altitudeM ?? 0,
      }).catch(() => {});
    }, 1500);
  }, [pilotLevel, mapState.overlay, mapState.altitudeM, token]);

  const toggleFavorite = useCallback(async (site) => {
    if (!token) { setShowAuthModal(true); return; }
    const id = String(site.id);
    if (favoriteSiteIds.has(id)) {
      await api.removeFavorite(token, id).catch(() => {});
      setFavoriteSiteIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } else {
      await api.addFavorite(token, id, site).catch(() => {});
      setFavoriteSiteIds(prev => new Set([...prev, id]));
    }
  }, [token, favoriteSiteIds]);

  const allSites = useMemo(() => [...(sites ?? []), ...extraSites], [sites, extraSites]);

  const filteredSites = useMemo(() => {
    if (!allSites.length) return [];
    if (!searchQuery.trim()) return allSites;
    const q = searchQuery.toLowerCase();
    return allSites.filter(s =>
      s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)
    );
  }, [allSites, searchQuery]);

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
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignIn={(u, tok) => { signIn(u, tok); setShowAuthModal(false); }}
        />
      )}
      {showAddSite && (
        <AddSiteModal
          onClose={() => setShowAddSite(false)}
          onCreated={site => setExtraSites(prev => [...prev, site])}
        />
      )}
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
        onAddSite={() => setShowAddSite(true)}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={signOut}
        favoriteSiteIds={favoriteSiteIds}
        onToggleFavorite={toggleFavorite}
      />
      <MapCanvas
        sites={allSites}
        activeSiteId={activeSite?.id}
        onSelectSite={setActiveSite}
        siteStatuses={siteStatuses}
        weather={activeWeather ?? []}
        mapState={mapState}
        onMapStateChange={setMapState}
        forecastDays={forecastDays}
        onForecastDaysChange={setForecastDays}
        onOpenSidebar={() => setSidebarOpen(true)}
        activeSite={activeSite}
      />
      {activeSite && (
        <RightPanel site={activeSite} onClose={() => setActiveSite(null)} pilotLevel={pilotLevel} forecastDays={forecastDays} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
