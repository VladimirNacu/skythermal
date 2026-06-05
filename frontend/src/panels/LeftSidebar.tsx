import { MapPin, Plus, Search, Star } from "lucide-react";
import { useSites } from "@/api/hooks";
import { useMapStore } from "@/state/mapState";
import { LayerPanel } from "./LayerPanel";
import { DriveDecisionCard } from "./DriveDecisionCard";
import { Spinner, ErrorBanner } from "./common";

export function LeftSidebar() {
  const { data: sites, isLoading, error } = useSites();
  const selectedId = useMapStore((s) => s.selectedSiteId);
  const selectSite = useMapStore((s) => s.selectSite);

  return (
    <aside className="st-sidebar">
      <div className="st-brand">
        <div className="st-brand-mark" />
        <span>SkyThermal</span>
      </div>

      <div className="st-search">
        <Search size={15} />
        <input placeholder="Search location or site…" />
        <kbd>⌘K</kbd>
      </div>

      <div className="st-side-head">
        <span>Launch Sites</span>
        <button className="st-icon-btn"><Plus size={14} /></button>
      </div>

      <div className="st-favorites">
        {isLoading && <Spinner label="Loading sites…" />}
        {error && <ErrorBanner message="Could not load sites" />}
        {sites?.map((site) => (
          <button
            key={site.id}
            className={`st-fav ${selectedId === site.id ? "active" : ""}`}
            onClick={() => selectSite(site.id)}
          >
            <MapPin size={14} />
            <span>
              <b>{site.name}</b>
              <small>{site.region} · {site.country_code}</small>
            </span>
            <Star size={13} className={selectedId === site.id ? "st-star-on" : ""} />
          </button>
        ))}
      </div>

      <div className="st-side-head st-side-head-layers">
        <span>Quick Layers</span>
      </div>
      <LayerPanel />

      <DriveDecisionCard />
    </aside>
  );
}
