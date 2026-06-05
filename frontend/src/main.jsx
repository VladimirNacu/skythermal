import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, Star, Plus, Wind, CloudSun, CloudRain, Zap, Eye,
  Thermometer, Mountain, Gauge, Car, Navigation, Layers,
  Crosshair, Maximize, Ruler, Play, Pause, ChevronDown,
  MapPin, Plane, BrainCircuit, Clock, ShieldAlert, Cloud, Activity,
  AlertTriangle, Loader
} from "lucide-react";
import "./styles.css";

// ─── API ─────────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8080";

const api = {
  listSites: () =>
    fetch(`${BASE}/v1/sites`).then((r) => r.json()),

  siteFlyabilityTimeline: (siteId, pilotLevel = "intermediate") =>
    fetch(`${BASE}/v1/flyability/sites/${siteId}/timeline?pilot_level=${pilotLevel}`).then((r) => r.json()),

  siteWeatherHourly: (siteId) =>
    fetch(`${BASE}/v1/weather/sites/${siteId}/hourly`).then((r) => r.json()),

  recommendations: (lat, lon, radiusKm = 180, pilotLevel = "intermediate") =>
    fetch(
      `${BASE}/v1/sites/recommendations?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&pilot_level=${pilotLevel}`
    ).then((r) => r.json()),

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
    }).then((r) => r.json());
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STATUS_COLOR = { GO: "green", MAYBE: "yellow", NO_GO: "red", UNKNOWN: "red" };

function statusColor(status) {
  return STATUS_COLOR[status] ?? "red";
}

function fmtTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function useAsync(asyncFn, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    asyncFn()
      .then((data) => { if (alive) setState({ data, loading: false, error: null }); })
      .catch((err) => { if (alive) setState({ data: null, loading: false, error: err.message }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

// ─── Layer config ─────────────────────────────────────────────────────────────
const INITIAL_LAYERS = [
  { id: "surfaceWind",  label: "Surface Wind",          icon: Wind,        active: true  },
  { id: "altitudeWind", label: "Wind at Altitude",       icon: Wind,        active: true, value: "1000 m" },
  { id: "gusts",        label: "Gusts",                  icon: Activity,    active: false },
  { id: "thermals",     label: "Thermals",               icon: Gauge,       active: false },
  { id: "cloudbase",    label: "Cloudbase",              icon: Cloud,       active: false },
  { id: "cape",         label: "CAPE / Instability",     icon: ShieldAlert, active: false },
  { id: "rainRadar",    label: "Rain Radar",             icon: CloudRain,   active: false },
  { id: "lightning",    label: "Lightning",              icon: Zap,         active: false },
  { id: "visibility",   label: "Visibility",             icon: Eye,         active: false },
  { id: "tempDewpoint", label: "Temperature / Dewpoint", icon: Thermometer, active: false },
  { id: "rotor",        label: "Wave / Rotor Risk",      icon: Mountain,    active: false },
  { id: "foehn",        label: "Foehn Indicator",        icon: Wind,        active: false },
];

// ─── Small reusable components ────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="spinner-wrap">
      <Loader size={22} className="spin" />
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="errorBanner">
      <AlertTriangle size={16} />
      <span>{message}</span>
    </div>
  );
}

function WindArrow({ deg, kmh, type }) {
  const blowTo = (deg + 180) % 360;
  const color = type === "orange" ? "#ff8b26" : type === "blue" ? "#2f9bff" : "#61d956";
  return (
    <div className="windArrow" title={`Wind from ${deg}° · ${kmh} km/h`}>
      <svg width="22" height="22" viewBox="0 0 22 22">
        <g transform={`rotate(${blowTo} 11 11)`}>
          <line x1="11" y1="18" x2="11" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <polygon points="11,2 7,9 15,9" fill={color} />
        </g>
      </svg>
      <span style={{ color }}>{kmh}</span>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ sites, activeSiteId, onSelectSite, bestStatus }) {
  const [layers, setLayers] = useState(INITIAL_LAYERS);

  function toggleLayer(id) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l)));
  }

  const driveStatus = bestStatus ?? "UNKNOWN";
  const driveColor = statusColor(driveStatus);
  const driveCopy = {
    GO: "Great day ahead!\nWorth the drive.",
    MAYBE: "Conditions marginal.\nAssess on site.",
    NO_GO: "Unsafe today.\nStay home.",
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
        <input placeholder="Search location or site…" />
        <kbd>⌘ K</kbd>
      </div>

      <div className="sideHeader">
        <span>Launch Sites</span>
        <button className="iconButton small"><Plus size={15} /></button>
      </div>

      <div className="favorites">
        {sites.map((site) => (
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
        <span>Quick Layers</span>
      </div>

      <div className="layerList">
        {layers.map((layer) => {
          const Icon = layer.icon;
          return (
            <button
              className={`layerRow ${layer.active ? "active" : ""}`}
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
            >
              <Icon size={15} />
              <span>{layer.label}</span>
              {layer.value && <em>{layer.value}</em>}
              <i className={`toggle ${layer.active ? "on" : ""}`} />
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

// ─── Map ─────────────────────────────────────────────────────────────────────
const MAP_MARKERS = [
  { left: "43%", top: "37%", type: "blue",   windDeg: 315, windKmh: 12, label: "Vaga Launch" },
  { left: "30%", top: "24%", type: "green",  windDeg: 290, windKmh:  8 },
  { left: "36%", top: "30%", type: "green",  windDeg: 310, windKmh: 10 },
  { left: "26%", top: "52%", type: "green",  windDeg: 270, windKmh:  7 },
  { left: "44%", top: "62%", type: "green",  windDeg: 330, windKmh: 11 },
  { left: "61%", top: "28%", type: "green",  windDeg: 285, windKmh: 13 },
  { left: "25%", top: "79%", type: "orange", windDeg: 215, windKmh: 22 },
  { left: "64%", top: "13%", type: "orange", windDeg: 140, windKmh: 26 },
];

function MapCanvas({ weather }) {
  const [altitude, setAltitude] = useState("1000 m");
  const [airspace, setAirspace]  = useState(true);

  return (
    <main className="mapShell">
      <div className="mapBackground">
        <div className="topLegend">
          <span>Wind speed (km/h)</span>
          <div className="legendGradient">
            {[0, 10, 20, 30, 40, 50, 60, 70, "80+"].map((v) => <b key={v}>{v}</b>)}
          </div>
        </div>

        <div className="altitudeControl">
          <span>Altitude</span>
          {["500 m", "1000 m", "1500 m", "2000 m"].map((alt) => (
            <button
              className={alt === altitude ? "selected" : ""}
              key={alt}
              onClick={() => setAltitude(alt)}
            >
              {alt}
            </button>
          ))}
        </div>

        <div className="airspaceChip" onClick={() => setAirspace((v) => !v)} style={{ cursor: "pointer" }}>
          Airspace <strong>{airspace ? "ON" : "OFF"}</strong> <ChevronDown size={13} />
        </div>

        {airspace && (
          <>
            <div className="airspaceZone zoneOne">TMA OSLO<br />SFC–FL095</div>
            <div className="airspaceZone zoneTwo">CTR FAGERNES<br />SFC–3500ft</div>
          </>
        )}

        <div className="mapLabels">
          <span style={{ left: "10%", top: "12%" }}>Jotunheimen</span>
          <span style={{ left: "20%", top: "24%" }}>Vågå</span>
          <span style={{ left: "30%", top: "37%" }}>Lillehammer</span>
          <span style={{ left: "58%", top: "38%" }}>Hafjell</span>
          <span style={{ left: "68%", top: "53%" }}>Gjøvik</span>
          <span style={{ left: "76%", top: "48%" }}>Oslo</span>
          <span style={{ left: "50%", top: "64%" }}>Kongsberg</span>
          <span style={{ left: "73%", top: "80%" }}>Drammen</span>
        </div>

        {MAP_MARKERS.map((m, idx) => (
          <div className="siteMarkerWrap" style={{ left: m.left, top: m.top }} key={idx}>
            <div className={`siteMarker ${m.type}`}>
              <Plane size={15} />
              {m.label && <span>{m.label}</span>}
            </div>
            <WindArrow deg={m.windDeg} kmh={m.windKmh} type={m.type} />
          </div>
        ))}

        <div className="mapControls">
          <button><Navigation size={18} /></button>
          <button>+</button>
          <button>−</button>
          <button><Layers size={18} /></button>
          <button><Crosshair size={18} /></button>
          <button>3D</button>
          <button><Ruler size={17} /></button>
          <button><Maximize size={17} /></button>
        </div>
      </div>

      <Timeline weather={weather} />
    </main>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────
function Timeline({ weather }) {
  const [range, setRange] = useState("1D");
  const [playing, setPlaying] = useState(false);

  const hours = weather ?? [];
  const times = hours.length
    ? hours.map((h) => fmtTime(h.valid_time))
    : ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];

  const winds      = hours.map((h) => Math.round(h.wind_kmh));
  const gusts      = hours.map((h) => Math.round(h.gust_kmh));
  const thermals   = hours.map((h) => h.thermal_strength_ms?.toFixed(1) ?? "—");
  const cloudbases = hours.map((h) => h.cloudbase_msl_m);

  return (
    <section className="timelinePanel">
      <div className="timelineTop">
        <button className="dateButton">
          Today <small>{new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</small>{" "}
          <ChevronDown size={14} />
        </button>
        <button className="playButton" onClick={() => setPlaying((v) => !v)}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="timeTrack">
          {(hours.length ? times.slice(0, 8) : times).map((t) => <span key={t}>{t}</span>)}
          <div className="currentTime"><b>{times[0] ?? "—"}</b></div>
        </div>
        <div className="rangeButtons">
          {["1D", "3D", "5D"].map((r) => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{r}</button>
          ))}
          <button><Layers size={16} /></button>
        </div>
      </div>

      <div className="timelineRows">
        <WeatherStrip label="Wind (km/h)"     values={winds.length      ? winds      : [6,8,10,12,14,16,14,10,6,4]} />
        <WeatherStrip label="Gusts (km/h)"    values={gusts.length      ? gusts      : [12,14,18,22,24,26,22,18,14,10]} />
        <WeatherStrip label="Thermals (m/s)"  values={thermals.length   ? thermals   : [0.6,0.9,1.4,2.2,3.0,3.2,2.4,1.6,1.0,0.6]} />
        <WeatherStrip label="Cloud base (m)"  values={cloudbases.length ? cloudbases : [800,1000,1300,1600,1900,2100,1800,1400,1000,800]} />
      </div>
    </section>
  );
}

function WeatherStrip({ label, values }) {
  return (
    <div className="weatherStrip">
      <span>{label}</span>
      <div className="legendGradient stripGradient" style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)` }}>
        {values.map((v, idx) => <b key={idx}>{v}</b>)}
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
  if (!weather || !weather.length) return null;
  return (
    <div className="miniForecast">
      <h3>Today · {new Date().toLocaleDateString([], { day: "numeric", month: "short" })}</h3>
      <div className="forecastTable">
        <div className="forecastRow head">
          <span />
          {weather.map((h) => <b key={h.valid_time}>{fmtTime(h.valid_time)}</b>)}
        </div>
        <div className="forecastRow">
          <span>km/h</span>
          {weather.map((h) => <b key={h.valid_time}>{Math.round(h.wind_kmh)}</b>)}
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
          {weather.map((h) => <b key={h.valid_time}>{h.cloudbase_msl_m}</b>)}
        </div>
        <div className="forecastRow">
          <span>rain mm</span>
          {weather.map((h) => <b key={h.valid_time}>{h.rain_mm}</b>)}
        </div>
      </div>
    </div>
  );
}

function BlockerList({ blockers }) {
  if (!blockers || !blockers.length) return null;
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

function RightPanel({ site, onClose }) {
  const [tab, setTab] = useState("Overview");

  const { data: timeline, loading: tlLoading, error: tlError } =
    useAsync(() => api.siteFlyabilityTimeline(site.id), [site.id]);

  const { data: weather, loading: wxLoading, error: wxError } =
    useAsync(() => api.siteWeatherHourly(site.id), [site.id]);

  const { data: briefingData, loading: brLoading, error: brError } =
    useAsync(() => api.briefing(site.id), [site.id]);

  const decision = timeline?.[0];
  const color = statusColor(decision?.status);
  const fi = decision?.flyability_score ?? 0;

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
        {["Overview", "Forecast", "Details", "Notes"].map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          {tlLoading && <Spinner />}
          {tlError && <ErrorBanner message={`Flyability error: ${tlError}`} />}

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
                <Metric
                  title="Wind at Launch" value={Math.round(decision.wind_kmh)} suffix="km/h"
                  note={`From ${decision.wind_direction_deg}°`} icon={<Wind size={22} />}
                />
                <Metric
                  title="Gusts" value={Math.round(decision.gust_kmh)} suffix="km/h"
                  icon={<Activity size={22} />}
                />
                <Metric
                  title="Cloudbase" value={decision.cloudbase_msl_m} suffix="m"
                  note="MSL" icon={<CloudSun size={23} />}
                />
                <Metric
                  title="Thermals" value={decision.thermal_strength_ms?.toFixed(1) ?? "—"} suffix="m/s"
                  icon={<Gauge size={23} />}
                />
              </div>

              <BlockerList blockers={decision.blockers} />

              <button className={`goBar ${color}`}>
                <Clock size={20} />
                <b>{decision.status.replace("_", "-")}</b>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {decision.explanation?.[0] ?? ""}
                </span>
                <ChevronDown size={16} />
              </button>
            </>
          )}

          {wxLoading && <Spinner />}
          {wxError && <ErrorBanner message={`Weather error: ${wxError}`} />}
          {weather && <HourlyForecast weather={weather} />}

          <div className="aiCard">
            <h3><BrainCircuit size={20} /> AI Flight Briefing <em>BETA</em></h3>
            {brLoading && <p style={{ color: "var(--muted)", fontSize: 13 }}>Generating briefing…</p>}
            {brError && <ErrorBanner message={`Briefing error: ${brError}`} />}
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
          {wxError && <ErrorBanner message={wxError} />}
          {weather && <HourlyForecast weather={weather} />}
          {timeline && (
            <div className="miniForecast" style={{ marginTop: 12 }}>
              <h3>Flyability Timeline</h3>
              <div className="forecastTable">
                <div className="forecastRow head">
                  <span />
                  {timeline.map((h) => <b key={h.valid_time}>{fmtTime(h.valid_time)}</b>)}
                </div>
                <div className="forecastRow">
                  <span>status</span>
                  {timeline.map((h) => (
                    <b key={h.valid_time} style={{ color: `var(--${statusColor(h.status)})`, fontSize: 10 }}>
                      {h.status.replace("_", "-")}
                    </b>
                  ))}
                </div>
                <div className="forecastRow">
                  <span>fly</span>
                  {timeline.map((h) => <b key={h.valid_time}>{h.flyability_score}</b>)}
                </div>
                <div className="forecastRow">
                  <span>safety</span>
                  {timeline.map((h) => <b key={h.valid_time}>{h.safety_score}</b>)}
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
          {site.hazards?.length > 0 && <p><b>Hazards:</b> {site.hazards.join(" · ")}</p>}
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

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const { data: sites, loading, error } = useAsync(api.listSites, []);
  const [activeSite, setActiveSite] = useState(null);

  // auto-select first site once loaded
  useEffect(() => {
    if (sites?.length && !activeSite) setActiveSite(sites[0]);
  }, [sites]);

  // derive best overall status for Drive card
  const [bestStatus, setBestStatus] = useState(null);
  useEffect(() => {
    if (!activeSite) return;
    api.siteFlyabilityTimeline(activeSite.id)
      .then((tl) => setBestStatus(tl?.[0]?.status ?? "UNKNOWN"))
      .catch(() => setBestStatus("UNKNOWN"));
  }, [activeSite?.id]);

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
        <p style={{ fontSize: 12, opacity: 0.6 }}>Is the backend running on {BASE}?</p>
      </div>
    </div>
  );

  return (
    <div className="app">
      <Sidebar
        sites={sites ?? []}
        activeSiteId={activeSite?.id}
        onSelectSite={setActiveSite}
        bestStatus={bestStatus}
      />
      <MapCanvas weather={null} />
      {activeSite && (
        <RightPanel site={activeSite} onClose={() => setActiveSite(null)} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
