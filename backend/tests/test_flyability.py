from datetime import datetime, timezone

from backend.app.data.seed import SITES
from backend.app.models import PilotProfile, WeatherHour
from backend.app.services.flyability import score_hour


def test_hard_blocker_for_storm_risk_forces_no_go():
    hour = WeatherHour(
        valid_time=datetime.now(timezone.utc),
        wind_kmh=10,
        gust_kmh=15,
        wind_direction_deg=330,
        cloudbase_msl_m=2000,
        storm_risk=80,
    )
    decision = score_hour(SITES[0], hour, PilotProfile())
    assert decision.status == "NO_GO"
    assert any(blocker.code == "STORM_RISK" for blocker in decision.blockers)


def test_safe_weather_can_be_go_candidate():
    hour = WeatherHour(
        valid_time=datetime.now(timezone.utc),
        wind_kmh=14,
        gust_kmh=20,
        wind_direction_deg=330,
        cloudbase_msl_m=1900,
        thermal_strength_ms=1.2,
    )
    decision = score_hour(SITES[0], hour, PilotProfile())
    assert decision.status == "GO"
    assert decision.safety_score >= 70

