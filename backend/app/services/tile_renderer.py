"""
Weather tile renderer — generates 256×256 RGBA PNG tiles from Open-Meteo data.

Approach: fetch a coarse 8×8 point grid over the tile bbox in one batch request,
map values through a colour ramp, upscale to 256×256 with bilinear interpolation,
return PNG bytes.  Tiles are Redis-cached for 30 minutes.
"""
import base64
import io
import logging
import math
from datetime import datetime, timezone

import httpx
from PIL import Image

from backend.app.services.weather_fetcher import _cache_get, _cache_set

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
GRID_N  = 8    # sample points per axis  (64 total — one batch request per tile)
TILE_PX = 256

# ─── Tile math ────────────────────────────────────────────────────────────────

def tile_bbox(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    n = 2 ** z
    lon_min = x / n * 360.0 - 180.0
    lon_max = (x + 1) / n * 360.0 - 180.0
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return lat_min, lat_max, lon_min, lon_max

# ─── Colour ramps: (value, (R, G, B, A)) ─────────────────────────────────────
# Each overlay defines its own ramp; values outside the range clamp to end stops.

RAMPS: dict[str, list[tuple]] = {
    "temperature_dewpoint": [
        (-20, (10,  30, 140, 215)),
        (0,   (40,  85, 200, 215)),
        (10,  (100, 175, 225, 215)),
        (20,  (235, 235,  55, 215)),
        (30,  (245, 130,  25, 215)),
        (40,  (200,  25,  25, 215)),
    ],
    "cloudbase": [
        (0,    (10,  20,  55, 205)),
        (500,  (20,  55, 110, 200)),
        (1000, (45,  95, 155, 195)),
        (1500, (70, 135, 185, 185)),
        (2000, (115, 175, 215, 175)),
        (3000, (170, 215, 245, 160)),
        (4000, (215, 238, 255, 140)),
    ],
    "thermals": [
        (0,   (  5,   5,  20,   0)),
        (0.2, ( 20,  45, 145, 145)),
        (0.6, ( 50, 115, 205, 175)),
        (1.2, ( 80, 195, 105, 195)),
        (2.0, (215, 215,  40, 210)),
        (3.0, (245,  90,  20, 220)),
        (4.0, (205,  25,  25, 230)),
    ],
    "rain_radar": [
        (0,    (  0,   0,   0,   0)),
        (0.05, ( 30,  85, 215, 135)),
        (0.5,  ( 60, 135, 255, 185)),
        (2,    (115,  40, 215, 205)),
        (5,    (215,  20, 175, 215)),
        (10,   (250,  20,  55, 225)),
        (20,   (215, 215,  20, 235)),
    ],
    "cape_instability": [
        (0,    ( 20,  20,  40,   0)),
        (50,   ( 30,  65, 135, 135)),
        (200,  ( 60, 115, 215, 170)),
        (500,  (165, 165,  40, 195)),
        (1000, (225, 105,  20, 215)),
        (2000, (205,  30,  30, 225)),
        (3000, (145,  10,  10, 235)),
    ],
    "visibility": [
        (0,   (135,  20,  20, 220)),
        (2,   (170,  85,  30, 210)),
        (5,   (190, 150,  45, 190)),
        (10,  (100, 170,  60, 170)),
        (20,  ( 40, 160,  80, 145)),
        (50,  ( 20, 110,  60, 115)),
    ],
    "wave_rotor_risk": [
        (0,   ( 20,  90,  20, 110)),
        (20,  ( 60, 150,  40, 160)),
        (40,  (205, 205,  40, 185)),
        (60,  (225, 120,  20, 205)),
        (80,  (205,  40,  20, 220)),
        (100, (145,  10,  10, 235)),
    ],
    "foehn_indicator": [
        (0,   ( 20,  45, 135, 115)),
        (25,  ( 60, 110, 210, 160)),
        (50,  (165, 165,  60, 185)),
        (75,  (225, 120,  20, 205)),
        (100, (205,  40,  20, 220)),
    ],
}

# Open-Meteo hourly variable(s) needed per overlay
_OVL_VARS: dict[str, str] = {
    "temperature_dewpoint": "temperature_2m",
    "cloudbase":            "temperature_2m,dewpoint_2m",
    "thermals":             "cape,cloudcover",
    "rain_radar":           "precipitation",
    "cape_instability":     "cape",
    "visibility":           "visibility",
    "wave_rotor_risk":      "windspeed_10m,windgusts_10m",
    "foehn_indicator":      "windspeed_10m,temperature_2m,dewpoint_2m",
}

# ─── Value extractor ──────────────────────────────────────────────────────────

def _val(overlay: str, hourly: dict, idx: int, hour: int) -> float | None:
    def g(key):
        vals = hourly.get(key, [])
        v = vals[idx] if idx < len(vals) else None
        return float(v) if v is not None else None

    if overlay == "temperature_dewpoint":
        return g("temperature_2m")

    if overlay == "cloudbase":
        t, td = g("temperature_2m"), g("dewpoint_2m")
        return max(0.0, (t - td) * 125.0) if t is not None and td is not None else None

    if overlay == "thermals":
        cape  = g("cape")      or 0.0
        cloud = g("cloudcover") or 0.0
        base  = (3.5 if cape > 1000 else 2.5 if cape > 500 else 1.5 if cape > 200
                 else 0.8 if cape > 50 else 0.4 if cape > 10 else 0.0)
        if base == 0.0:
            return 0.0
        diurnal  = max(0.0, 1.0 - abs(hour - 13.5) / 7.0)
        cloud_p  = max(0.0, 1.0 - cloud / 90.0)
        return base * diurnal * cloud_p

    if overlay == "rain_radar":
        return g("precipitation") or 0.0

    if overlay == "cape_instability":
        return g("cape") or 0.0

    if overlay == "visibility":
        v = g("visibility")
        return (v / 1000.0) if v is not None else None  # → km

    if overlay == "wave_rotor_risk":
        spd  = g("windspeed_10m")  or 0.0
        gust = g("windgusts_10m") or 0.0
        return min(100.0, spd * 1.2 + max(0.0, gust - spd) * 2.0)

    if overlay == "foehn_indicator":
        spd = g("windspeed_10m") or 0.0
        t, td = g("temperature_2m"), g("dewpoint_2m")
        dry = (t - td) if (t is not None and td is not None) else 0.0
        return min(100.0, spd * 0.8 + dry * 2.5)

    return None

# ─── Colour interpolation ─────────────────────────────────────────────────────

def _lerp(value: float, ramp: list) -> tuple[int, int, int, int]:
    if value <= ramp[0][0]:
        return ramp[0][1]
    if value >= ramp[-1][0]:
        return ramp[-1][1]
    for i in range(len(ramp) - 1):
        v0, c0 = ramp[i]
        v1, c1 = ramp[i + 1]
        if v0 <= value <= v1:
            t = (value - v0) / (v1 - v0)
            return tuple(max(0, min(255, int(a + t * (b - a)))) for a, b in zip(c0, c1))
    return ramp[-1][1]

# ─── Tile cache (base64 → string → Redis) ────────────────────────────────────

def _get_cached(key: str) -> bytes | None:
    val = _cache_get(key)
    return base64.b64decode(val) if val else None

def _set_cached(key: str, data: bytes, ttl: int = 1800) -> None:
    _cache_set(key, base64.b64encode(data).decode(), ttl)

# ─── Public API ───────────────────────────────────────────────────────────────

def render_tile(
    overlay: str, z: int, x: int, y: int,
    time_iso: str | None = None,
    altitude_m: int = 0,
) -> bytes:
    """Return 256×256 RGBA PNG bytes for the given weather overlay tile."""
    ramp = RAMPS.get(overlay)
    if ramp is None:
        return _empty_tile()

    cache_key = f"tile2:{overlay}:{z}:{x}:{y}:{(time_iso or 'now')[:13]}:{altitude_m}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    lat_min, lat_max, lon_min, lon_max = tile_bbox(z, x, y)
    lat_min = max(-85.0, lat_min)
    lat_max = min( 85.0, lat_max)
    if lat_min >= lat_max or lon_min >= lon_max:
        return _empty_tile()

    # Build grid of GRID_N × GRID_N sample points
    def linspace(lo, hi, n):
        return [lo + (hi - lo) * i / (n - 1) for i in range(n)] if n > 1 else [(lo + hi) / 2]

    lats   = linspace(lat_min, lat_max, GRID_N)
    lons   = linspace(lon_min, lon_max, GRID_N)
    points = [(lat, lon) for lat in lats for lon in lons]

    try:
        resp = httpx.get(
            OPEN_METEO_URL,
            params={
                "latitude":      ",".join(f"{p[0]:.4f}" for p in points),
                "longitude":     ",".join(f"{p[1]:.4f}" for p in points),
                "hourly":        _OVL_VARS.get(overlay, "temperature_2m"),
                "forecast_days": 1,
                "timezone":      "UTC",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.error("tile fetch failed (%s %d/%d/%d): %s", overlay, z, x, y, exc)
        return _empty_tile()

    if isinstance(data, dict):
        data = [data]

    # Resolve target forecast hour
    target_hour = datetime.now(timezone.utc).hour
    target_prefix = (time_iso or "")[:13]  # "2026-06-07T11"
    idx = 0
    if data:
        times = data[0].get("hourly", {}).get("time", [])
        for j, t in enumerate(times):
            if target_prefix and t[:13] == target_prefix:
                idx = j
                target_hour = int(t[11:13])
                break
            elif not target_prefix and t[:13] == datetime.now(timezone.utc).strftime("%Y-%m-%dT%H"):
                idx = j
                target_hour = datetime.now(timezone.utc).hour
                break

    # Render GRID_N × GRID_N coloured image
    img_small = Image.new("RGBA", (GRID_N, GRID_N), (0, 0, 0, 0))
    px = img_small.load()
    for i, pt_data in enumerate(data[:len(points)]):
        col = i % GRID_N
        row = GRID_N - 1 - (i // GRID_N)   # invert lat axis (PIL y=0 = top)
        val = _val(overlay, pt_data.get("hourly", {}), idx, target_hour)
        px[col, row] = _lerp(val, ramp) if val is not None else (0, 0, 0, 0)

    img = img_small.resize((TILE_PX, TILE_PX), Image.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False)
    raw = buf.getvalue()

    _set_cached(cache_key, raw)
    return raw


def _empty_tile() -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (TILE_PX, TILE_PX), (0, 0, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()
