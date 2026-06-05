import { useState } from "react";
import {
  Activity, AlertTriangle, ChevronDown, CloudSun, Clock, Gauge, Star, Wind, X,
} from "lucide-react";
import { useSites, useFlyabilityTimeline, useWeatherHourly } from "@/api/hooks";
import { useMapStore } from "@/state/mapState";
import { DECISION_COLOR, DECISION_LABEL } from "@/design/safety-colors";
import { AIFlightBriefingCard } from "./AIFlightBriefingCard";
import { ScoreRing, Spinner, ErrorBanner, StatusBadge } from "./common";
import type { Blocker, FlyabilityHour, WeatherHour } from "@/api/types";

const TABS = ["Overview", "Forecast", "Details", "Notes"] as const;
type Tab = (typeof TABS)[number];

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Metric({
  title, value, suffix, note, icon, ring,
}: {
  title: string; value: string | number; suffix?: string; note?: string;
  icon?: React.ReactNode; ring?: { value: number; tone: "good" | "warn" | "bad" };
}) {
  return (
    <div className="st-metric">
      <span>{title}</span>
      <div className="st-metric-body">
        {icon && <div className="st-metric-icon">{icon}</div>}
        <strong>{value}{suffix && <small>{suffix}</small>}</strong>
        {ring && <ScoreRing value={ring.value} tone={ring.tone} />}
      </div>
      {note && <p>{note}</p>}
    </div>
  );
}

function BlockerList({ blockers }: { blockers: Blocker[] }) {
  if (!blockers.length) return null;
  return (
    <div className="st-blockers">
      {blockers.map((b, i) => (
        <div key={i} className={`st-blocker ${b.severity}`}>
          <AlertTriangle size={13} />
          <span>{b.message}</span>
        </div>
      ))}
    </div>
  );
}

function HourlyTable({ weather }: { weather: WeatherHour[] }) {
  if (!weather.length) return null;
  return (
    <div className="st-mini-forecast">
      <h3>Today · {new Date().toLocaleDateString([], { day: "numeric", month: "short" })}</h3>
      <div className="st-fc-table">
        <div className="st-fc-row head">
          <span />
          {weather.map((h) => <b key={h.valid_time}>{fmt(h.valid_time)}</b>)}
        </div>
        <div className="st-fc-row">
          <span>km/h</span>
          {weather.map((h) => <b key={h.valid_time}>{Math.round(h.wind_kmh)}</b>)}
        </div>
        <div className="st-fc-row">
          <span>gusts</span>
          {weather.map((h) => <b key={h.valid_time}>{Math.round(h.gust_kmh)}</b>)}
        </div>
        <div className="st-fc-row">
          <span>thermals</span>
          {weather.map((h) => <b key={h.valid_time}>{h.thermal_strength_ms?.toFixed(1) ?? "—"}</b>)}
        </div>
        <div className="st-fc-row">
          <span>base m</span>
          {weather.map((h) => <b key={h.valid_time}>{h.cloudbase_msl_m}</b>)}
        </div>
        <div className="st-fc-row">
          <span>rain</span>
          {weather.map((h) => <b key={h.valid_time}>{h.rain_mm}</b>)}
        </div>
      </div>
    </div>
  );
}

function FlyabilityStrip({ timeline }: { timeline: FlyabilityHour[] }) {
  if (!timeline.length) return null;
  return (
    <div className="st-mini-forecast">
      <h3>Flyability timeline</h3>
      <div className="st-fc-table">
        <div className="st-fc-row head">
          <span />
          {timeline.map((h) => <b key={h.valid_time}>{fmt(h.valid_time)}</b>)}
        </div>
        <div className="st-fc-row">
          <span>status</span>
          {timeline.map((h) => (
            <b key={h.valid_time} style={{ color: DECISION_COLOR[h.status], fontSize: 9 }}>
              {DECISION_LABEL[h.status]}
            </b>
          ))}
        </div>
        <div className="st-fc-row">
          <span>fly</span>
          {timeline.map((h) => <b key={h.valid_time}>{h.flyability_score}</b>)}
        </div>
        <div className="st-fc-row">
          <span>safety</span>
          {timeline.map((h) => <b key={h.valid_time}>{h.safety_score}</b>)}
        </div>
      </div>
    </div>
  );
}

export function SiteDecisionPanel() {
  const [tab, setTab] = useState<Tab>("Overview");
  const pilot = useMapStore((s) => s.pilotLevel);
  const siteId = useMapStore((s) => s.selectedSiteId);
  const clear = useMapStore((s) => s.clearSelection);

  const { data: sites } = useSites();
  const site = sites?.find((s) => s.id === siteId);

  const { data: timeline, isLoading: tlLoading, error: tlError } =
    useFlyabilityTimeline(siteId, pilot);
  const { data: weather, isLoading: wxLoading, error: wxError } =
    useWeatherHourly(siteId);

  if (!siteId || !site) return null;

  const decision = timeline?.[0];

  return (
    <aside className="st-right-panel">
      <div className="st-site-title">
        <div>
          <h1><Star size={17} fill="currentColor" /> {site.name}</h1>
          <small>{site.region} · {site.country_code} · {site.altitude_m} m</small>
        </div>
        <button onClick={clear} aria-label="Close"><X size={20} /></button>
      </div>

      <nav className="st-tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          {tlLoading && <Spinner label="Scoring conditions…" />}
          {tlError && <ErrorBanner message={(tlError as Error).message} />}

          {decision && (
            <>
              <div className="st-metric-grid">
                <Metric
                  title="Flyability" value={decision.flyability_score} suffix="/100"
                  note={decision.flyability_score >= 75 ? "Excellent" : decision.flyability_score >= 55 ? "Good" : "Marginal"}
                  ring={{
                    value: decision.flyability_score,
                    tone: decision.flyability_score >= 70 ? "good" : decision.flyability_score >= 50 ? "warn" : "bad",
                  }}
                />
                <Metric
                  title="Safety" value={decision.safety_score} suffix="/100"
                  note={decision.safety_score >= 70 ? "Low risk" : decision.safety_score >= 50 ? "Moderate" : "High risk"}
                  ring={{
                    value: decision.safety_score,
                    tone: decision.safety_score >= 70 ? "good" : decision.safety_score >= 50 ? "warn" : "bad",
                  }}
                />
                <Metric title="Wind" value={Math.round(decision.wind_kmh)} suffix="km/h"
                  note={`From ${decision.wind_direction_deg}°`} icon={<Wind size={20} />} />
                <Metric title="Gusts" value={Math.round(decision.gust_kmh)} suffix="km/h"
                  icon={<Activity size={20} />} />
                <Metric title="Cloudbase" value={decision.cloudbase_msl_m} suffix="m"
                  note="MSL" icon={<CloudSun size={21} />} />
                <Metric title="Thermals" value={decision.thermal_strength_ms?.toFixed(1) ?? "—"} suffix="m/s"
                  icon={<Gauge size={21} />} />
              </div>

              <BlockerList blockers={decision.blockers} />

              <button className="st-go-bar" style={{ background: DECISION_COLOR[decision.status] }}>
                <Clock size={18} />
                <b>{DECISION_LABEL[decision.status]}</b>
                <span>{decision.explanation[0] ?? ""}</span>
                <ChevronDown size={15} />
              </button>
            </>
          )}

          {wxLoading && <Spinner />}
          {wxError && <ErrorBanner message={(wxError as Error).message} />}
          {weather && <HourlyTable weather={weather} />}

          <AIFlightBriefingCard siteId={siteId} />
        </>
      )}

      {tab === "Forecast" && (
        <>
          {weather && <HourlyTable weather={weather} />}
          {timeline && <FlyabilityStrip timeline={timeline} />}
        </>
      )}

      {tab === "Details" && (
        <div className="st-details">
          <p><b>Altitude:</b> {site.altitude_m} m</p>
          <p><b>Safe sectors:</b> {site.safe_directions.join(", ")}</p>
          <p><b>Difficulty:</b> {site.difficulty}</p>
          {site.hazards.length > 0 && <p><b>Hazards:</b> {site.hazards.join(" · ")}</p>}
          {site.local_rules.length > 0 && <p><b>Rules:</b> {site.local_rules.join(" · ")}</p>}
        </div>
      )}

      {tab === "Notes" && (
        <div className="st-details"><p>No notes for this site yet.</p></div>
      )}
    </aside>
  );
}
