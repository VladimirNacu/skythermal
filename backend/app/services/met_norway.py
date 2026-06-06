"""
MET Norway Locationforecast 2.0 (compact) — Phase 2 data source for Norwegian sites.

Free, no API key. Terms: CC BY 4.0, attribution required, commercial use allowed.
Required: User-Agent header identifying the app (MET Norway policy).

Provides point forecasts with: wind speed/direction, temperature, dewpoint,
cloud cover, precipitation. Does NOT provide CAPE, pressure-level winds, or gusts
directly in compact format — those fall back to Open-Meteo.
"""
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

MET_NO_URL  = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
USER_AGENT  = "SkyThermal/1.0 github.com/skythermal contact@skythermal.app"


def fetch_met_norway(lat: float, lon: float, altitude_m: int, days: int = 1):
    """
    Point forecast from MET Norway for a Norwegian launch site.
    Returns list[WeatherHour] or [] on failure.
    """
    from backend.app.models import WeatherHour  # avoid circular import at module level

    try:
        resp = httpx.get(
            MET_NO_URL,
            params={"lat": round(lat, 4), "lon": round(lon, 4), "altitude": altitude_m},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.error("MET Norway fetch failed (%.4f, %.4f): %s", lat, lon, exc)
        return []

    return _parse(resp.json(), altitude_m, days)


def _parse(data: dict, site_altitude_m: int, days: int):
    from backend.app.models import WeatherHour

    timeseries = data.get("properties", {}).get("timeseries", [])
    max_hours  = days * 24
    model_run  = datetime.now(timezone.utc)
    result     = []

    for ts in timeseries[:max_hours]:
        t_str   = ts.get("time", "")
        instant = ts.get("data", {}).get("instant", {}).get("details", {})
        next1   = ts.get("data", {}).get("next_1_hours", {}).get("details", {})

        wind_ms  = float(instant.get("wind_speed", 0.0))
        wind_kmh = wind_ms * 3.6
        wind_deg = int(float(instant.get("wind_from_direction", 0.0)))
        temp     = instant.get("air_temperature")
        dewpoint = instant.get("dew_point_temperature")
        cloud    = float(instant.get("cloud_area_fraction", 0.0))
        precip   = float(next1.get("precipitation_amount", 0.0))

        # Compact format has no gust field; estimate from speed
        gust_kmh = wind_kmh * 1.45

        # Cloudbase via Dürr LCL approximation
        if temp is not None and dewpoint is not None:
            cloudbase_agl = max(0.0, (float(temp) - float(dewpoint)) * 125.0)
        else:
            cloudbase_agl = 1500.0
        cloudbase_msl = int(cloudbase_agl) + site_altitude_m

        # Thermal estimate — diurnal envelope only (no CAPE in compact format)
        dt = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
        diurnal = max(0.0, 1.0 - abs(dt.hour - 13.5) / 7.0)
        cloud_penalty = max(0.0, 1.0 - cloud / 80.0)
        thermal_strength = round(2.2 * diurnal * cloud_penalty, 1) if diurnal > 0.1 else None

        storm_risk = min(100, int(precip * 18 + cloud * 0.25))

        result.append(WeatherHour(
            valid_time=dt,
            wind_kmh=round(wind_kmh, 1),
            gust_kmh=round(gust_kmh, 1),
            wind_direction_deg=wind_deg,
            cloudbase_msl_m=cloudbase_msl,
            thermal_strength_ms=thermal_strength,
            rain_mm=round(precip, 2),
            storm_risk=storm_risk,
            temperature_c=float(temp) if temp is not None else None,
            model="met-norway",
            model_run_time=model_run,
        ))

    return result
