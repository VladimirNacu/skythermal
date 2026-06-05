import { MapShell } from "@/map/MapShell";
import { LeftSidebar } from "@/panels/LeftSidebar";
import { SiteDecisionPanel } from "@/panels/SiteDecisionPanel";
import { ForecastTimeline } from "@/panels/ForecastTimeline";
import { MapOverlays } from "@/panels/MapOverlays";
import { useMapStore } from "@/state/mapState";

export function AppShell() {
  const selectedId = useMapStore((s) => s.selectedSiteId);

  return (
    <div className={`st-app ${selectedId ? "has-panel" : ""}`}>
      <LeftSidebar />

      <div className="st-center">
        <MapShell />
        <MapOverlays />
        <ForecastTimeline />
      </div>

      <SiteDecisionPanel />
    </div>
  );
}
