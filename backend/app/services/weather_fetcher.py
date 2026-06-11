"""
Fetches real forecast data from Open-Meteo (free, no API key required).
Caches results in Redis for 30 minutes to avoid hammering the upstream API.
Falls back gracefully if Open-Meteo or Redis are unreachable.
"""
import json
import logging
import math
import threading
import time
from datetime import datetime, timezone

import httpx

from backend.app.config import settings
from backend.app.models import WeatherHour

logger = logging.getLogger(__name__)

# Shared rate-limit gate for ALL Open-Meteo calls (tiles + wind-grid).
# Open-Meteo free tier enforces burst limits; this prevents concurrent hammering.
OM_LOCK = threading.Semaphore(2)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

HOURLY_VARS = ",".join([
    "windspeed_10m",
    "windgusts_10m",
    "winddirection_10m",
    "temperature_2m",
    "dewpoint_2m",
    "cloudcover",
    "precipitation",
    "cape",
    "visibility",
    "windspeed_925hPa",   # ≈ 500–800 m
    "winddirection_925hPa",
    "windspeed_850hPa",   # ≈ 1500 m
    "winddirection_850hPa",
    "windspeed_800hPa",   # ≈ 2000 m
    "winddirection_800hPa",
    "windspeed_750hPa",   # ≈ 2500 m
    "winddirection_750hPa",
    "windspeed_700hPa",   # ≈ 3000 m
    "winddirection_700hPa",
])

# ─── Redis (optional) ─────────────────────────────────────────────────────────

_redis = None


def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis as redis_lib  # noqa: PLC0415
        r = redis_lib.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2)
        r.ping()
        _redis = r
        return r
    except Exception as exc:
        logger.debug("Redis unavailable, skipping cache: %s", exc)
        return None


def _cache_get(key: str):
    r = _get_redis()
    if not r:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


def _cache_set(key: str, value: list, ttl: int = 1800):
    r = _get_redis()
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


# ─── Parse Open-Meteo response ────────────────────────────────────────────────

def _parse(data: dict, site_altitude_m: int, days: int) -> list[WeatherHour]:
    hourly = data["hourly"]
    times = hourly["time"]
    max_hours = days * 24
    model_run = datetime.now(timezone.utc)

    def g(key, i, default=None):
        vals = hourly.get(key)
        if vals and i < len(vals) and vals[i] is not None:
            return vals[i]
        return default

    result = []
    for i, t in enumerate(times[:max_hours]):
        wind_kmh = float(g("windspeed_10m", i, 0.0))
        gust_kmh = float(g("windgusts_10m", i, 0.0))
        wind_deg = int(g("winddirection_10m", i, 0))
        temp     = g("temperature_2m", i)
        dewpoint = g("dewpoint_2m", i)
        cape     = float(g("cape", i, 0.0) or 0.0)
        precip   = float(g("precipitation", i, 0.0) or 0.0)
        w850_kmh = g("windspeed_850hPa", i)
        w850_deg = g("winddirection_850hPa", i)
        w700_kmh = g("windspeed_700hPa", i)
        w700_deg = g("winddirection_700hPa", i)

        # Cloud base via Dürr LCL approximation
        if temp is not None and dewpoint is not None:
            cloudbase_agl = max(0.0, (float(temp) - float(dewpoint)) * 125.0)
        else:
            cloudbase_agl = 1500.0
        cloudbase_msl = int(cloudbase_agl) + site_altitude_m

        # Thermal strength: CAPE-based amplitude × diurnal envelope
        dt = datetime.fromisoformat(t).replace(tzinfo=timezone.utc)
        diurnal = max(0.0, 1.0 - abs(dt.hour - 13.5) / 7.0)
        if cape > 1000:
            base_thermal = 3.0
        elif cape > 500:
            base_thermal = 2.0
        elif cape > 200:
            base_thermal = 1.2
        elif cape > 50:
            base_thermal = 0.6
        elif cape > 10:
            base_thermal = 0.3
        else:
            base_thermal = 0.0
        thermal_strength = round(base_thermal * diurnal, 1) if base_thermal > 0 else None

        storm_risk = min(100, int(cape / 12.0 + precip * 25.0))

        result.append(WeatherHour(
            valid_time=dt,
            wind_kmh=wind_kmh,
            gust_kmh=gust_kmh,
            wind_direction_deg=wind_deg,
            cloudbase_msl_m=cloudbase_msl,
            thermal_strength_ms=thermal_strength,
            rain_mm=precip,
            storm_risk=storm_risk,
            temperature_c=float(temp) if temp is not None else None,
            wind_1500m_kmh=float(w850_kmh) if w850_kmh is not None else None,
            wind_1500m_deg=int(w850_deg) if w850_deg is not None else None,
            wind_3000m_kmh=float(w700_kmh) if w700_kmh is not None else None,
            wind_3000m_deg=int(w700_deg) if w700_deg is not None else None,
            model="open-meteo",
            model_run_time=model_run,
        ))
    return result


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_site_weather(
    lat: float, lon: float, site_altitude_m: int, days: int = 1, country_code: str = ""
) -> list[WeatherHour]:
    """
    Return hourly forecast for `days` days (1–5).
    Norwegian sites (country_code='NO') use MET Norway first, then fall back to Open-Meteo.
    Results cached 30 min in Redis.
    """
    days = max(1, min(5, days))

    # Phase 2 — MET Norway for Norwegian sites (more accurate for NO terrain)
    if country_code == "NO":
        try:
            from backend.app.services.met_norway import fetch_met_norway  # noqa: PLC0415
            result = fetch_met_norway(lat, lon, site_altitude_m, days)
            if result:
                return result
        except Exception as exc:
            logger.warning("MET Norway unavailable, falling back to Open-Meteo: %s", exc)

    cache_key = f"wx:{lat:.3f}:{lon:.3f}:{days}"

    cached = _cache_get(cache_key)
    if cached:
        return [WeatherHour.model_validate(h) for h in cached]

    try:
        resp = httpx.get(
            OPEN_METEO_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": HOURLY_VARS,
                "wind_speed_unit": "kmh",
                "forecast_days": days,
                "timezone": "UTC",
            },
            timeout=10,
        )
        resp.raise_for_status()
        hours = _parse(resp.json(), site_altitude_m, days)
        _cache_set(cache_key, [h.model_dump(mode="json") for h in hours])
        return hours
    except Exception as exc:
        logger.error("Open-Meteo fetch failed (%s, %s): %s", lat, lon, exc)
        return []


# ─── Wind grid (batch) ────────────────────────────────────────────────────────

def fetch_wind_grid(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    step: float = 1.0,
    altitude_m: int = 0,
) -> list[dict]:
    """Fetch wind U/V vectors on a regular lat/lon grid.

    Returns a list of {lat, lon, u_ms, v_ms, speed_kmh, direction_deg}.
    U = eastward component, V = northward component (m/s).
    """
    # Cap to ≤ 200 grid points
    n_lat = max(1, int((max_lat - min_lat) / step) + 1)
    n_lon = max(1, int((max_lon - min_lon) / step) + 1)
    if n_lat * n_lon > 200:
        step = math.sqrt((max_lat - min_lat) * (max_lon - min_lon) / 200)
        step = max(0.25, round(step * 4) / 4)
        n_lat = max(1, int((max_lat - min_lat) / step) + 1)
        n_lon = max(1, int((max_lon - min_lon) / step) + 1)

    lats   = [round(min_lat + i * step, 3) for i in range(n_lat)]
    lons   = [round(min_lon + j * step, 3) for j in range(n_lon)]
    points = [(lat, lon) for lat in lats for lon in lons]
    if not points:
        return []

    if altitude_m >= 2800:
        spd_var, dir_var = "windspeed_700hPa",  "winddirection_700hPa"   # ≈ 3000 m
    elif altitude_m >= 2200:
        spd_var, dir_var = "windspeed_750hPa",  "winddirection_750hPa"   # ≈ 2500 m
    elif altitude_m >= 1600:
        spd_var, dir_var = "windspeed_800hPa",  "winddirection_800hPa"   # ≈ 2000 m
    elif altitude_m >= 1000:
        spd_var, dir_var = "windspeed_850hPa",  "winddirection_850hPa"   # ≈ 1500 m
    elif altitude_m >= 400:
        spd_var, dir_var = "windspeed_925hPa",  "winddirection_925hPa"   # ≈ 750 m
    else:
        spd_var, dir_var = "windspeed_10m",      "winddirection_10m"

    cache_key = f"wgrid:{min_lat:.2f}:{max_lat:.2f}:{min_lon:.2f}:{max_lon:.2f}:{step:.2f}:{altitude_m}"
    cached    = _cache_get(cache_key)
    if cached:
        return cached

    lat_str = ",".join(str(p[0]) for p in points)
    lon_str = ",".join(str(p[1]) for p in points)

    om_params = {
        "latitude":       lat_str,
        "longitude":      lon_str,
        "hourly":         f"{spd_var},{dir_var}",
        "wind_speed_unit":"kmh",
        "forecast_days":  1,
        "timezone":       "UTC",
    }
    try:
        with OM_LOCK:
            resp = httpx.get(OPEN_METEO_URL, params=om_params, timeout=10)
            if resp.status_code == 429:
                logger.warning("wind-grid 429, retrying in 2s")
                time.sleep(2.0)
                resp = httpx.get(OPEN_METEO_URL, params=om_params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.error("wind-grid fetch failed: %s", exc)
        return []

    if isinstance(data, dict):
        data = [data]

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    result  = []

    for i, (lat, lon) in enumerate(points):
        if i >= len(data):
            break
        hourly = data[i].get("hourly", {})
        times  = hourly.get("time", [])
        speeds = hourly.get(spd_var, [])
        dirs   = hourly.get(dir_var, [])

        idx = 0
        for j, t in enumerate(times):
            if t == now_str:
                idx = j
                break

        speed_kmh = float(speeds[idx]) if idx < len(speeds) and speeds[idx] is not None else 0.0
        direction = float(dirs[idx])   if idx < len(dirs)   and dirs[idx]   is not None else 0.0
        speed_ms  = speed_kmh / 3.6
        dir_rad   = math.radians(direction)
        u_ms      = -speed_ms * math.sin(dir_rad)
        v_ms      = -speed_ms * math.cos(dir_rad)

        result.append({
            "lat":           lat,
            "lon":           lon,
            "u_ms":          round(u_ms,       3),
            "v_ms":          round(v_ms,       3),
            "speed_kmh":     round(speed_kmh,  1),
            "direction_deg": round(direction),
        })

    _cache_set(cache_key, result, ttl=1800)
    return result
