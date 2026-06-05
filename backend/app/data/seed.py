from datetime import datetime, timedelta, timezone
from uuid import UUID

from backend.app.models import LaunchSite, PilotLevel, WeatherHour

VAGA_ID = UUID("11111111-1111-4111-8111-111111111111")
HAFJELL_ID = UUID("22222222-2222-4222-8222-222222222222")
VOSS_ID = UUID("33333333-3333-4333-8333-333333333333")

SITES = [
    LaunchSite(
        id=VAGA_ID,
        name="Vaga Launch",
        country_code="NO",
        region="Gudbrandsdalen",
        lat=61.875,
        lon=9.096,
        altitude_m=940,
        difficulty=PilotLevel.intermediate,
        safe_directions=["NW", "N", "NE"],
        hazards=["Rotor in strong westerly flow", "Power lines near lower landing"],
        local_rules=["Check local club notices before launching"],
    ),
    LaunchSite(
        id=HAFJELL_ID,
        name="Hafjell Ridge",
        country_code="NO",
        region="Innlandet",
        lat=61.247,
        lon=10.447,
        altitude_m=1030,
        difficulty=PilotLevel.beginner,
        safe_directions=["S", "SW", "SE"],
        hazards=["Thermal turbulence over tree line"],
    ),
    LaunchSite(
        id=VOSS_ID,
        name="Voss Hanguren",
        country_code="NO",
        region="Vestland",
        lat=60.632,
        lon=6.414,
        altitude_m=660,
        difficulty=PilotLevel.xc,
        safe_directions=["W", "NW", "SW"],
        hazards=["Fast valley wind changes", "Busy airspace on event days"],
    ),
]


def demo_weather(site_id: UUID) -> list[WeatherHour]:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    profiles = {
        VAGA_ID: [(18, 27, 330, 1800, 1.7, 0, 10), (23, 35, 345, 1550, 1.2, 0, 20), (31, 45, 300, 1200, 0.3, 1.0, 55)],
        HAFJELL_ID: [(12, 19, 205, 1500, 1.0, 0, 5), (16, 23, 220, 1700, 1.4, 0, 8), (21, 29, 240, 1400, 0.8, 0.2, 15)],
        VOSS_ID: [(26, 39, 270, 900, 0.7, 0.4, 35), (34, 48, 285, 780, 0.2, 2.2, 70), (22, 32, 300, 1200, 1.5, 0, 25)],
    }
    return [
        WeatherHour(
            valid_time=now + timedelta(hours=index),
            wind_kmh=wind,
            gust_kmh=gust,
            wind_direction_deg=direction,
            cloudbase_msl_m=cloudbase,
            thermal_strength_ms=thermal,
            rain_mm=rain,
            storm_risk=storm,
            model_run_time=now - timedelta(hours=2),
        )
        for index, (wind, gust, direction, cloudbase, thermal, rain, storm) in enumerate(profiles[site_id])
    ]

