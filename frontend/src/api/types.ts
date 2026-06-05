// Domain types — mirror backend/app/models.py

export type DecisionStatus = "GO" | "MAYBE" | "NO_GO" | "UNKNOWN";

export type PilotLevel = "beginner" | "intermediate" | "xc" | "competition";

export type BlockerSeverity = "warning" | "hard";

export interface LaunchSite {
  id: string;
  name: string;
  country_code: string;
  region: string;
  lat: number;
  lon: number;
  altitude_m: number;
  difficulty: PilotLevel;
  safe_directions: string[];
  hazards: string[];
  local_rules: string[];
}

export interface WeatherHour {
  valid_time: string;
  wind_kmh: number;
  gust_kmh: number;
  wind_direction_deg: number;
  cloudbase_msl_m: number;
  thermal_strength_ms: number | null;
  rain_mm: number;
  storm_risk: number;
  model: string;
  model_run_time: string;
}

export interface Blocker {
  code: string;
  severity: BlockerSeverity;
  message: string;
}

export interface FlyabilityHour {
  valid_time: string;
  status: DecisionStatus;
  flyability_score: number;
  safety_score: number;
  confidence: number;
  wind_kmh: number;
  gust_kmh: number;
  wind_direction_deg: number;
  cloudbase_msl_m: number;
  thermal_strength_ms: number | null;
  blockers: Blocker[];
  explanation: string[];
}

export interface SiteRecommendation {
  site_id: string;
  name: string;
  distance_km: number;
  status: DecisionStatus;
  flyability_score: number;
  safety_score: number;
  xc_score: number | null;
  best_window: { start: string; end: string } | null;
  top_reasons: string[];
  blockers: string[];
}

export interface GroundedFact {
  source: string;
  observed_at: string;
  fact: string;
}

export interface BriefingResponse {
  answer: string;
  recommendation: DecisionStatus;
  confidence: number;
  grounded_facts: GroundedFact[];
  blockers: Blocker[];
  follow_up_actions: string[];
  generated_at: string;
  safety_footer: string;
}

export interface MobileBootstrap {
  min_version: string;
  feature_flags: Record<string, boolean>;
  entitlements: Record<string, string[]>;
}
