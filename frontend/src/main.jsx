import React, { useMemo, useState } from "react";
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

const favoriteSites = [
  { name: "Montegrappa", country: "Italy", active: true },
  { name: "Bassano", country: "Italy" },
  { name: "Annecy", country: "France" },
  { name: "Chamonix Planpraz", country: "France" },
  { name: "Kobala", country: "Slovenia" }
];

const layers = [
  { id: "surfaceWind", label: "Surface Wind", icon: Wind, active: true },
  { id: "altitudeWind", label: "Wind at Altitude", value: "1000 m", icon: Wind, active: true },
  { id: "gusts", label: "Gusts", icon: Activity },
  { id: "thermals", label: "Thermals", icon: Gauge },
  { id: "cloudbase", label: "Cloudbase", icon: Cloud },
  { id: "cape", label: "CAPE / Instability", icon: ShieldAlert },
  { id: "rainRadar", label: "Rain Radar", icon: CloudRain },
  { id: "lightning", label: "Lightning", icon: Zap },
  { id: "visibility", label: "Visibility", icon: Eye },
  { id: "tempDewpoint", label: "Temperature / Dewpoint", icon: Thermometer },
  { id: "rotor", label: "Wave / Rotor Risk", icon: Mountain },
  { id: "foehn", label: "Foehn Indicator", icon: Wind }
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
  { left: "43%", top: "37%", type: "blue", label: "Montegrappa" },
  { left: "30%", top: "24%", type: "green" },
  { left: "36%", top: "30%", type: "green" },
  { left: "26%", top: "52%", type: "green" },
  { left: "44%", top: "62%", type: "green" },
  { left: "32%", top: "72%", type: "green" },
  { left: "61%", top: "28%", type: "green" },
  { left: "58%", top: "20%", type: "green" },
  { left: "22%", top: "41%", type: "green" },
  { left: "25%", top: "79%", type: "orange" },
  { left: "39%", top: "29%", type: "orange" },
  { left: "64%", top: "13%", type: "orange" }
];

function Sidebar() {
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
        {favoriteSites.map((site) => (
          <button className={`favoriteItem ${site.active ? "active" : ""}`} key={site.name}>
            <MapPin size={14} />
            <span>
              <b>{site.name}</b>
              <small>{site.country}</small>
            </span>
            <Star size={14} className={site.active ? "starOn" : ""} />
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
            <button className={`layerRow ${layer.active ? "active" : ""}`} key={layer.id}>
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

function MapCanvas() {
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
            <button className={alt === "1000 m" ? "selected" : ""} key={alt}>{alt}</button>
          ))}
        </div>

        <div className="airspaceChip">
          Airspace <strong>ON</strong> <ChevronDown size={13} />
        </div>

        <div className="airspaceZone zoneOne">FL195<br />FL95</div>
        <div className="airspaceZone zoneTwo">CTR MILANO<br />SFC - 3500ft</div>

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
          <div className={`siteMarker ${m.type}`} style={{ left: m.left, top: m.top }} key={idx}>
            <Plane size={15} />
            {m.label && <span>{m.label}</span>}
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
  const times = ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"];
  return (
    <section className="timelinePanel">
      <div className="timelineTop">
        <button className="dateButton">Today <small>Thu 22 May</small> <ChevronDown size={14} /></button>
        <button className="playButton"><Play size={17} fill="currentColor" /></button>
        <div className="timeTrack">
          {times.map((t) => <span key={t}>{t}</span>)}
          <div className="currentTime"><b>11:00</b></div>
        </div>
        <div className="rangeButtons">
          <button className="active">1D</button>
          <button>3D</button>
          <button>5D</button>
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

function RightPanel() {
  return (
    <aside className="rightPanel">
      <div className="siteTitle">
        <div>
          <h1><Star size={18} fill="currentColor" /> Montegrappa</h1>
          <small>Italy</small>
        </div>
        <button>×</button>
      </div>

      <nav className="tabs">
        <button className="active">Overview</button>
        <button>Forecast</button>
        <button>Details</button>
        <button>Notes</button>
      </nav>

      <div className="metricGrid">
        <Metric title="Flyability Score" value="82" suffix="/100" note="Excellent day!" ring="green" />
        <Metric title="Risk Score" value="26" suffix="/100" note="Low risk" ring="yellow" />
        <Metric title="Wind at Launch" value="12" suffix="km/h" note="NW" icon={<Wind size={22} />} />
        <Metric title="Gusts" value="24" suffix="km/h" note="" icon={<Activity size={22} />} />
        <Metric title="Cloudbase" value="1950" suffix="m" note="AGL" icon={<CloudSun size={23} />} />
        <Metric title="Thermals" value="Strong" suffix="3.2 m/s" note="" icon={<Gauge size={23} />} />
      </div>

      <div className="launchWindow">
        <span>Best launch window</span>
        <strong>11:00 – 15:00</strong>
        <small>Local time</small>
      </div>

      <button className="goBar"><Clock size={20} /> <b>GO</b> Excellent conditions <ChevronDown size={16} /></button>

      <MiniForecast />

      <div className="aiCard">
        <h3><BrainCircuit size={20} /> AI Flight Briefing <em>BETA</em></h3>
        <p>
          High pressure and strong insolation should generate excellent thermals by late morning.
          Light NW winds at launch with a sea-breeze component later. Cloudbase &gt;1900 m with low
          overdevelopment risk. Great day for XC.
        </p>
        <div className="confidence">
          <span>Confidence: <b>High</b></span>
          <div><i /></div>
          <strong>92%</strong>
        </div>
      </div>
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
  return (
    <div className="app">
      <Sidebar />
      <MapCanvas />
      <RightPanel />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
