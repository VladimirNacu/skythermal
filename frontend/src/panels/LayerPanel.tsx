import { useMapStore } from "@/state/mapState";
import { LAYER_GROUPS, layersByGroup, type Entitlement } from "@/design/layer-registry";

const ENT_LABEL: Record<Entitlement, string | null> = {
  free: null,
  pro: "PRO",
  pro_plus: "PRO+",
};

export function LayerPanel() {
  const overlay = useMapStore((s) => s.overlay);
  const setOverlay = useMapStore((s) => s.setOverlay);

  return (
    <div className="st-layer-panel">
      {LAYER_GROUPS.map((group) => (
        <div key={group} className="st-layer-group">
          <div className="st-layer-group-title">{group}</div>
          {layersByGroup(group).map((layer) => {
            const active = overlay === layer.id;
            const ent = ENT_LABEL[layer.entitlement];
            return (
              <button
                key={layer.id}
                className={`st-layer-row ${active ? "active" : ""}`}
                onClick={() => setOverlay(layer.id)}
              >
                <span className="st-layer-label">{layer.label}</span>
                {ent && <em className={`st-ent st-ent-${layer.entitlement}`}>{ent}</em>}
                <i className={`st-toggle ${active ? "on" : ""}`} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
