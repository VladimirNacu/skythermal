import { ChevronDown } from "lucide-react";
import { useMapStore, type AltitudeM } from "@/state/mapState";
import { LAYER_REGISTRY } from "@/design/layer-registry";

const ALTITUDES: AltitudeM[] = [500, 1000, 1500, 2000];

export function MapOverlays() {
  const overlay = useMapStore((s) => s.overlay);
  const altitudeM = useMapStore((s) => s.altitudeM);
  const setAltitude = useMapStore((s) => s.setAltitude);
  const airspaceEnabled = useMapStore((s) => s.airspaceEnabled);
  const toggleAirspace = useMapStore((s) => s.toggleAirspace);

  const def = LAYER_REGISTRY[overlay];
  const legend = def.legend;
  const showAltitude = !!def.altitudeSelector;

  return (
    <>
      {legend && (
        <div className="st-legend">
          <span>{def.label} ({legend.unit})</span>
          <div className="st-legend-gradient">
            {legend.ticks.map((t) => <b key={t}>{t}</b>)}
          </div>
        </div>
      )}

      {showAltitude && (
        <div className="st-altitude">
          <span>Altitude</span>
          {ALTITUDES.map((a) => (
            <button
              key={a}
              className={a === altitudeM ? "selected" : ""}
              onClick={() => setAltitude(a)}
            >
              {a} m
            </button>
          ))}
        </div>
      )}

      <button className="st-airspace-chip" onClick={toggleAirspace}>
        Airspace <strong>{airspaceEnabled ? "ON" : "OFF"}</strong> <ChevronDown size={12} />
      </button>
    </>
  );
}
