import { useEffect } from "react";
import { ChevronDown, Layers, Pause, Play } from "lucide-react";
import { useMapStore } from "@/state/mapState";
import { useSites, useWeatherHourly } from "@/api/hooks";
import { windColor } from "@/design/safety-colors";
import type { WeatherHour } from "@/api/types";

function Strip({
  label, hours, pick, fmt, threshold,
}: {
  label: string;
  hours: WeatherHour[];
  pick: (h: WeatherHour) => number;
  fmt?: (v: number) => string;
  threshold?: number;
}) {
  return (
    <div className="st-tl-row">
      <span>{label}</span>
      <div className="st-tl-strip" style={{ gridTemplateColumns: `repeat(${hours.length}, 1fr)` }}>
        {hours.map((h) => {
          const v = pick(h);
          const over = threshold != null && v > threshold;
          return (
            <b
              key={h.valid_time}
              style={{ background: windColor(v), outline: over ? "1.5px solid #fff" : "none" }}
            >
              {fmt ? fmt(v) : Math.round(v)}
            </b>
          );
        })}
      </div>
    </div>
  );
}

export function ForecastTimeline() {
  const playing = useMapStore((s) => s.timelinePlaying);
  const togglePlay = useMapStore((s) => s.togglePlay);
  const setValidTime = useMapStore((s) => s.setValidTime);
  const selectedId = useMapStore((s) => s.selectedSiteId);

  const { data: sites } = useSites();
  const targetId = selectedId ?? sites?.[0]?.id;
  const { data: weather } = useWeatherHourly(targetId);

  const hours = weather ?? [];

  // playback: advance valid time across available hours
  useEffect(() => {
    if (!playing || !hours.length) return;
    let idx = 0;
    const timer = window.setInterval(() => {
      idx = (idx + 1) % hours.length;
      setValidTime(hours[idx].valid_time);
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing, hours, setValidTime]);

  const today = new Date().toLocaleDateString([], {
    weekday: "short", day: "numeric", month: "short",
  });

  return (
    <section className="st-timeline">
      <div className="st-tl-top">
        <button className="st-date-btn">
          Today <small>{today}</small> <ChevronDown size={13} />
        </button>
        <button className="st-play-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <div className="st-time-track">
          {hours.map((h) => (
            <span key={h.valid_time}>
              {new Date(h.valid_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ))}
        </div>
        <div className="st-range-btns">
          {["1D", "3D", "5D"].map((r) => (
            <button key={r} className={r === "1D" ? "active" : ""}>{r}</button>
          ))}
          <button><Layers size={15} /></button>
        </div>
      </div>

      {hours.length > 0 ? (
        <div className="st-tl-rows">
          <Strip label="Wind (km/h)" hours={hours} pick={(h) => h.wind_kmh} />
          <Strip label="Gusts (km/h)" hours={hours} pick={(h) => h.gust_kmh} threshold={38} />
          <Strip
            label="Thermals (m/s)" hours={hours}
            pick={(h) => (h.thermal_strength_ms ?? 0) * 16}
            fmt={(v) => (v / 16).toFixed(1)}
          />
          <Strip
            label="Cloud base (m)" hours={hours}
            pick={(h) => h.cloudbase_msl_m / 30}
            fmt={(v) => String(Math.round(v * 30))}
          />
        </div>
      ) : (
        <div className="st-tl-empty">Select a site to load the forecast timeline.</div>
      )}
    </section>
  );
}
