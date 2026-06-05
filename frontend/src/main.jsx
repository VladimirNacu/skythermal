import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search,
  Star,
  Plus,
  Wind,
  CloudSun,
  CloudRain,
  Zap,
  Eye,
  Thermometer,
  Mountain,
  Gauge,
  Car,
  Navigation,
  Layers,
  Crosshair,
  Maximize,
  Ruler,
  Play,
  Pause,
  ChevronDown,
  MapPin,
  Plane,
  BrainCircuit,
  Clock,
  ShieldAlert,
  Cloud,
  Activity
} from "lucide-react";
import "./styles.css";

const INITIAL_SITES = [
  { name: "Montegrappa", country: "Italy" },
  { name: "Bassano", country: "Italy" },
  { name: "Annecy", country: "France" },
  { name: "Chamonix Planpraz", country: "France" },
  { name: "Kobala", country: "Slovenia" }
];

const INITIAL_LAYERS = [
  { id: "surfaceWind", label: "Surface Wind", icon: Wind, active: true },
  { id: "altitudeWind", label: "Wind at Altitude", value: "1000 m", icon: Wind, active: true },
  { id: "gusts", label: "Gusts", icon: Activity, active: false },
  { id: "thermals", label: "Thermals", icon: Gauge, active: false },
  { id: "cloudbase", label: "Cloudbase", icon: Cloud, active: false },
  { id: "cape", label: "CAPE / Instability", icon: ShieldAlert, active: false },
  { id: "rainRadar", label: "Rain Radar", icon: CloudRain, active: false },
  { id: "lightning", label: "Lightning", icon: Zap, active: false },
  { id: "visibility", label: "Visibility", icon: Eye, active: false },
  { id: "tempDewpoint", label: "Temperature / Dewpoint", icon: Thermometer, active: false },
  { id: "rotor", label: "Wave / Rotor Risk", icon: Mountain, active: false },
  { id: "foehn", label: "Foehn Indicator", icon: Wind, active: false }
];

const hourly = [
  { t: "08:00", wind: 6, gust: 12, thermals: 1.4, cloudbase: 1200, rain: "0%" },
  { t: "09:00", wind: 8, gust: 16, thermals: 1.8, cloudbase: 1400, rain: "0%" },
  { t: "10:00", wind: 10, gust: 20, thermals: 2.2, cloudbase: 1600, rain: "0%" },
  { t: "11:00", wind: 12, gust: 24, thermals: 3.0, cloudbase: 1900, rain: "0%" },
  { t: "12:00", wind: 14, gust: 26, thermals: 3.2, cloudbase: 2200, rain: "0%" },
  { t: "13:00", wind: 16, gust: 24, thermals: 3.1, cloudbase: 2300, rain: "0%" },
  { t: "14:00", wind: 14, gust: 22, thermals: 2.6, cloudbase: 2000, rain: "0%" },
  { t: "15:00", wind: 12, gust: 18, thermals: 2.0, cloudbase: 1800, rain: "0%" },
  { t: "16:00", wind: 10, gust: 16, thermals: 1.6, cloudbase: 1500, rain: "0%" },
  { t: "17:00", wind: 8, gust: 14, thermals: 1.2, cloudbase: 1300, rain: "0%" }
];

const markers = [
  { left: "43%", top: "37%", type: "blue",   label: "Montegrappa", windDeg: 315, windKmh: 12 },
  { left: "30%", top: "24%", type: "green",                         windDeg: 290, windKmh:  8 },
  { left: "36%", top: "30%", type: "green",                         windDeg: 310, windKmh: 10 },
  { left: "26%", top: "52%", type: "green",                         windDeg: 270, windKmh:  7 },
  { left: "44%", top: "62%", type: "green",                         windDeg: 330, windKmh: 11 },
  { left: "32%", top: "72%", type: "green",                         windDeg: 300, windKmh:  9 },
  { left: "61%", top: "28%", type: "green",                         windDeg: 285, windKmh: 13 },
  { left: "58%", top: "20%", type: "green",                         windDeg: 320, windKmh:  6 },
  { left: "22%", top: "41%", type: "green",                         windDeg: 295, windKmh:  8 },
  { left: "25%", top: "79%", type: "orange",                        windDeg: 215, windKmh: 22 },
  { left: "39%", top: "29%", type: "orange",                        windDeg: 180, windKmh: 19 },
  { left: "64%", top: "13%", type: "orange",                        windDeg: 140, windKmh: 26 }
];

function Sidebar({ activeSite, onSelectSite }) {
  const [layers, setLayers] = useState(INITIAL_LAYERS);

  function toggleLayer(id) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">▰</div>
        <span>SkyThermal</span>
      </div>

      <div className="searchBox">
        <Search size={16} />
        <input placeholder="Search location or site..." />
        <kbd>⌘ K</kbd>
      </div>

      <div className="sideHeader">
        <span>Favorite Sites</span>
        <button className="iconButton small"><Plus size={15} /></button>
      </div>

      <div className="favorites">
        {INITIAL_SITES.map((site) => (
          <button
            className={`favoriteItem ${activeSite === site.name ? "active" : ""}`}
            key={site.name}
            onClick={() => onSelectSite(site.name)}
          >
            <MapPin size={14} />
            <span>
              <b>{site.name}</b>
              <small>{site.country}</small>
            </span>
            <Star size={14} className={activeSite === site.name ? "starOn" : ""} />
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
          <strong>GO</strong>
          <p>Great day ahead!<br />Worth the drive.</p>
          <a>Show details →</a>
        </div>
      </div>
    </aside>
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

function MapCanvas() {
  const [altitude, setAltitude] = useState("1000 m");
  const [airspace, setAirspace] = useState(true);

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

        <div className="airspaceChip" onClick={() => setAirspace(v => !v)} style={{ cursor: "pointer" }}>
          Airspace <strong>{airspace ? "ON" : "OFF"}</strong> <ChevronDown size={13} />
        </div>

        {airspace && (
          <>
            <div className="airspaceZone zoneOne">FL195<br />FL95</div>
            <div className="airspaceZone zoneTwo">CTR MILANO<br />SFC - 3500ft</div>
          </>
        )}

        <div className="mapLabels">
          <span style={{ left: "10%", top: "12%" }}>Lake Geneva</span>
          <span style={{ left: "20%", top: "24%" }}>Chamonix</span>
          <span style={{ left: "30%", top: "37%" }}>Aosta</span>
          <span style={{ left: "58%", top: "38%" }}>Biella</span>
          <span style={{ left: "68%", top: "53%" }}>Novara</span>
          <span style={{ left: "76%", top: "48%" }}>Milan</span>
          <span style={{ left: "50%", top: "64%" }}>Torino</span>
          <span style={{ left: "73%", top: "80%" }}>Genova</span>
        </div>

        {markers.map((m, idx) => (
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

      <Timeline />
    </main>
  );
}

function Timeline() {
  const [range, setRange] = useState("1D");
  const [playing, setPlaying] = useState(false);
  const times = ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];

  return (
    <section className="timelinePanel">
      <div className="timelineTop">
        <button className="dateButton">Today <small>Thu 22 May</small> <ChevronDown size={14} /></button>
        <button className="playButton" onClick={() => setPlaying(v => !v)}>
          {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
        </button>
        <div className="timeTrack">
          {times.map((t) => <span key={t}>{t}</span>)}
          <div className="currentTime"><b>11:00</b></div>
        </div>
        <div className="rangeButtons">
          {["1D", "3D", "5D"].map(r => (
            <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>{r}</button>
          ))}
          <button><Layers size={16} /></button>
        </div>
      </div>

      <div className="timelineRows">
        <WeatherStrip label="Wind (km/h)" values={[6,8,10,12,14,16,14,10,6,4]} />
        <WeatherStrip label="Gusts (km/h)" values={[12,14,18,22,24,26,22,18,14,10]} />
        <WeatherStrip label="Thermals (m/s)" values={[0.6,0.9,1.4,2.2,3.0,3.2,2.4,1.6,1.0,0.6]} />
        <WeatherStrip label="Cloud base (m)" values={[800,1000,1300,1600,1900,2100,1800,1400,1000,800]} />
      </div>
    </section>
  );
}

function WeatherStrip({ label, values }) {
  return (
    <div className="weatherStrip">
      <span>{label}</span>
      <div className="stripGradient">
        {values.map((v, idx) => <b key={idx}>{v}</b>)}
      </div>
    </div>
  );
}

const SITE_DATA = {
  Montegrappa: { country: "Italy", flyability: 82, risk: 26, wind: 12, gust: 24, windDir: "NW", cloudbase: 1950, thermals: "Strong", thermalsMs: 3.2, window: "11:00 – 15:00", status: "GO", statusNote: "Excellent conditions" },
  Bassano:     { country: "Italy", flyability: 74, risk: 34, wind: 14, gust: 28, windDir: "N",  cloudbase: 1700, thermals: "Moderate", thermalsMs: 2.4, window: "12:00 – 16:00", status: "GO", statusNote: "Good conditions" },
  Annecy:      { country: "France", flyability: 58, risk: 48, wind: 18, gust: 34, windDir: "SW", cloudbase: 1400, thermals: "Weak", thermalsMs: 1.2, window: "13:00 – 15:00", status: "MAYBE", statusNote: "Check wind before launch" },
  "Chamonix Planpraz": { country: "France", flyability: 31, risk: 72, wind: 32, gust: 48, windDir: "W", cloudbase: 900, thermals: "None", thermalsMs: 0, window: "—", status: "NO_GO", statusNote: "Wind too strong" },
  Kobala:      { country: "Slovenia", flyability: 68, risk: 38, wind: 10, gust: 20, windDir: "NE", cloudbase: 1600, thermals: "Moderate", thermalsMs: 2.1, window: "11:00 – 14:00", status: "GO", statusNote: "Good morning window" },
};

const STATUS_COLOR = { GO: "green", MAYBE: "yellow", NO_GO: "red" };

function RightPanel({ site, onClose }) {
  const [tab, setTab] = useState("Overview");
  const data = SITE_DATA[site] || SITE_DATA["Montegrappa"];
  const color = STATUS_COLOR[data.status] || "green";

  return (
    <aside className="rightPanel">
      <div className="siteTitle">
        <div>
          <h1><Star size={18} fill="currentColor" /> {site}</h1>
          <small>{data.country}</small>
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
          <div className="metricGrid">
            <Metric title="Flyability Score" value={data.flyability} suffix="/100" note={data.flyability >= 75 ? "Excellent day!" : data.flyability >= 55 ? "Good day" : "Marginal"} ring={data.flyability >= 70 ? "green" : data.flyability >= 50 ? "yellow" : "red"} />
            <Metric title="Risk Score" value={data.risk} suffix="/100" note={data.risk <= 30 ? "Low risk" : data.risk <= 55 ? "Moderate risk" : "High risk"} ring={data.risk <= 30 ? "yellow" : "red"} />
            <Metric title="Wind at Launch" value={data.wind} suffix="km/h" note={data.windDir} icon={<Wind size={22} />} />
            <Metric title="Gusts" value={data.gust} suffix="km/h" note="" icon={<Activity size={22} />} />
            <Metric title="Cloudbase" value={data.cloudbase} suffix="m" note="AGL" icon={<CloudSun size={23} />} />
            <Metric title="Thermals" value={data.thermals} suffix={`${data.thermalsMs} m/s`} note="" icon={<Gauge size={23} />} />
          </div>

          <div className="launchWindow">
            <span>Best launch window</span>
            <strong>{data.window}</strong>
            <small>Local time</small>
          </div>

          <button className={`goBar ${color}`}>
            <Clock size={20} /> <b>{data.status.replace("_", "-")}</b> {data.statusNote} <ChevronDown size={16} />
          </button>

          <MiniForecast />

          <div className="aiCard">
            <h3><BrainCircuit size={20} /> AI Flight Briefing <em>BETA</em></h3>
            <p>
              {data.status === "GO"
                ? "High pressure and strong insolation should generate excellent thermals by late morning. Light winds at launch with stable conditions. Great day for XC."
                : data.status === "MAYBE"
                ? "Conditions are marginal. Wind speeds are elevated and cloudbase is lower than ideal. Monitor conditions closely before committing to launch."
                : "Conditions are unsafe for flight today. Strong winds and low cloudbase create serious hazards. Do not launch."}
            </p>
            <div className="confidence">
              <span>Confidence: <b>{data.flyability >= 70 ? "High" : data.flyability >= 50 ? "Medium" : "Low"}</b></span>
              <div><i /></div>
              <strong>{data.flyability >= 70 ? "92%" : data.flyability >= 50 ? "74%" : "58%"}</strong>
            </div>
          </div>
        </>
      )}

      {tab === "Forecast" && (
        <div style={{ padding: "1rem" }}>
          <MiniForecast />
        </div>
      )}

      {tab === "Details" && (
        <div style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.7 }}>
          <p><b>Wind:</b> {data.wind} km/h {data.windDir} · Gusts {data.gust} km/h</p>
          <p><b>Cloudbase:</b> {data.cloudbase} m AGL</p>
          <p><b>Thermals:</b> {data.thermals} ({data.thermalsMs} m/s)</p>
          <p><b>Flyability:</b> {data.flyability}/100 · Risk: {data.risk}/100</p>
          <p><b>Best window:</b> {data.window}</p>
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

function MiniForecast() {
  return (
    <div className="miniForecast">
      <h3>Today, 22 May</h3>
      <div className="forecastTable">
        <div className="forecastRow head">
          <span />
          {hourly.map((h) => <b key={h.t}>{h.t}</b>)}
        </div>
        <div className="forecastRow icons">
          <span />
          {hourly.map((h, i) => <b key={h.t}>{i < 3 ? "☀️" : "🌤️"}</b>)}
        </div>
        <ForecastRow label="km/h" field="wind" />
        <ForecastRow label="gusts" field="gust" highlight />
        <ForecastRow label="thermals" field="thermals" highlight />
        <ForecastRow label="cloud base" field="cloudbase" />
        <ForecastRow label="rain" field="rain" />
      </div>
    </div>
  );
}

function ForecastRow({ label, field, highlight }) {
  return (
    <div className="forecastRow">
      <span>{label}</span>
      {hourly.map((h, i) => (
        <b className={highlight && i >= 3 && i <= 7 ? "good" : ""} key={h.t}>{h[field]}</b>
      ))}
    </div>
  );
}

function App() {
  const [activeSite, setActiveSite] = useState("Montegrappa");

  return (
    <div className="app">
      <Sidebar activeSite={activeSite} onSelectSite={setActiveSite} />
      <MapCanvas />
      <RightPanel site={activeSite} onClose={() => setActiveSite(null)} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
