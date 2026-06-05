import { AlertTriangle, Loader2 } from "lucide-react";
import type { DecisionStatus } from "@/api/types";
import { DECISION_COLOR, DECISION_LABEL } from "@/design/safety-colors";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="st-spinner">
      <Loader2 size={20} className="st-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-error">
      <AlertTriangle size={15} />
      <span>{message}</span>
    </div>
  );
}

export function StatusBadge({ status, big }: { status: DecisionStatus; big?: boolean }) {
  return (
    <span
      className={`st-badge ${big ? "st-badge-big" : ""}`}
      style={{ background: DECISION_COLOR[status] }}
    >
      {DECISION_LABEL[status]}
    </span>
  );
}

export function ScoreRing({ value, tone }: { value: number; tone: "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "var(--decision-go)" : tone === "warn" ? "var(--decision-maybe)" : "var(--decision-no-go)";
  return (
    <div
      className="st-ring"
      style={{
        background: `conic-gradient(${color} ${value}%, rgba(255,255,255,0.14) 0)`,
      }}
    >
      <span>{value}</span>
    </div>
  );
}
