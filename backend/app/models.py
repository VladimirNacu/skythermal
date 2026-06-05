from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DecisionStatus(StrEnum):
    GO = "GO"
    MAYBE = "MAYBE"
    NO_GO = "NO_GO"
    UNKNOWN = "UNKNOWN"


class PilotLevel(StrEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    xc = "xc"
    competition = "competition"


class PilotProfile(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    pilot_level: PilotLevel = PilotLevel.intermediate
    wing_class: str = "EN-B"
    max_wind_kmh: int = 28
    max_gust_kmh: int = 38
    max_accepted_risk: int = 70


class LaunchSite(BaseModel):
    id: UUID
    name: str
    country_code: str
    region: str
    lat: float
    lon: float
    altitude_m: int
    difficulty: PilotLevel
    safe_directions: list[str]
    hazards: list[str] = []
    local_rules: list[str] = []


class WeatherHour(BaseModel):
    valid_time: datetime
    wind_kmh: float
    gust_kmh: float
    wind_direction_deg: int
    cloudbase_msl_m: int
    thermal_strength_ms: float | None = None
    rain_mm: float = 0
    storm_risk: int = Field(ge=0, le=100, default=0)
    model: str = "demo-best"
    model_run_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Blocker(BaseModel):
    code: str
    severity: Literal["warning", "hard"]
    message: str


class FlyabilityHour(BaseModel):
    valid_time: datetime
    status: DecisionStatus
    flyability_score: int = Field(ge=0, le=100)
    safety_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    wind_kmh: float
    gust_kmh: float
    wind_direction_deg: int
    cloudbase_msl_m: int
    thermal_strength_ms: float | None
    blockers: list[Blocker]
    explanation: list[str]


class SiteRecommendation(BaseModel):
    site_id: UUID
    name: str
    distance_km: float
    status: DecisionStatus
    flyability_score: int
    safety_score: int
    xc_score: int | None = None
    best_window: dict[str, datetime] | None = None
    top_reasons: list[str]
    blockers: list[str]


class BriefingRequest(BaseModel):
    question: str
    site_id: UUID | None = None
    pilot_profile: PilotProfile = Field(default_factory=PilotProfile)
    start: datetime
    end: datetime
    include_sources: bool = True


class GroundedFact(BaseModel):
    source: str
    observed_at: datetime
    fact: str


class BriefingResponse(BaseModel):
    answer: str
    recommendation: DecisionStatus
    confidence: float
    grounded_facts: list[GroundedFact]
    blockers: list[Blocker]
    follow_up_actions: list[str]
    generated_at: datetime
    safety_footer: str


class StationUplink(BaseModel):
    station_id: UUID
    observed_at: datetime
    wind_kmh: float
    gust_kmh: float
    wind_direction_deg: int
    temperature_c: float | None = None
    pressure_hpa: float | None = None
    battery_v: float | None = None

