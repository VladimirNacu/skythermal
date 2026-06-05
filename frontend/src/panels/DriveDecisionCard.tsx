import { Car } from "lucide-react";
import { useSites, useFlyabilityTimeline } from "@/api/hooks";
import { useMapStore } from "@/state/mapState";
import { DECISION_COLOR, DECISION_LABEL } from "@/design/safety-colors";
import type { DecisionStatus } from "@/api/types";

const COPY: Record<DecisionStatus, string> = {
  GO: "Great day ahead. Worth the drive.",
  MAYBE: "Conditions marginal. Assess on site.",
  NO_GO: "Unsafe today. Stay home.",
  UNKNOWN: "Select a site to evaluate.",
};

export function DriveDecisionCard() {
  const pilot = useMapStore((s) => s.pilotLevel);
  const selectedId = useMapStore((s) => s.selectedSiteId);
  const { data: sites } = useSites();
  const targetId = selectedId ?? sites?.[0]?.id;
  const { data: timeline } = useFlyabilityTimeline(targetId, pilot);

  const status: DecisionStatus = timeline?.[0]?.status ?? "UNKNOWN";

  return (
    <div className="st-drive-card">
      <div className="st-drive-head">
        <span>Drive or Don't Drive</span>
        <button aria-label="info">?</button>
      </div>
      <div className="st-drive-body">
        <div className="st-drive-arc" />
        <Car size={34} />
        <strong style={{ color: DECISION_COLOR[status] }}>{DECISION_LABEL[status]}</strong>
        <p>{COPY[status]}</p>
      </div>
    </div>
  );
}
