import { BrainCircuit } from "lucide-react";
import { useBriefing } from "@/api/hooks";
import { useMapStore } from "@/state/mapState";
import { Spinner, ErrorBanner } from "./common";

export function AIFlightBriefingCard({ siteId }: { siteId: string }) {
  const pilot = useMapStore((s) => s.pilotLevel);
  const { data, isLoading, error } = useBriefing(siteId, pilot);

  const pct = data ? Math.round(data.confidence * 100) : 0;

  return (
    <div className="st-ai-card">
      <h3>
        <BrainCircuit size={18} /> AI Flight Briefing <em>BETA</em>
      </h3>

      {isLoading && <Spinner label="Generating briefing…" />}
      {error && <ErrorBanner message={(error as Error).message} />}

      {data && (
        <>
          <p>{data.answer}</p>

          {data.follow_up_actions.length > 0 && (
            <ul className="st-followups">
              {data.follow_up_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          <div className="st-confidence">
            <span>
              Confidence: <b>{pct >= 70 ? "High" : pct >= 50 ? "Medium" : "Low"}</b>
            </span>
            <div className="st-confidence-track">
              <i style={{ width: `${pct}%` }} />
            </div>
            <strong>{pct}%</strong>
          </div>

          <p className="st-safety-footer">⚠ {data.safety_footer}</p>
        </>
      )}
    </div>
  );
}
