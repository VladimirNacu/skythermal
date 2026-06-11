"""
Background wind-grid ingestion: pre-fetches Open-Meteo wind data every hour
for the Romania core region at 6 altitudes, stored in PostgreSQL.
User requests are served from DB cache instead of hitting Open-Meteo directly.

Rate-limit strategy:
  - Only one region: Romania core, step=2.0° → 18 points per call (18 API credits)
  - 6 altitudes × 18 pts = 108 credits per cycle
  - Cycle every 3600s → 2,592 credits/day (safe on free tier)
  - 30s between altitude calls to avoid burst limits
  - If ANY call returns 429, abort the cycle and reschedule in 1 hour
"""
import json
import logging
import threading
import time
from datetime import datetime, timezone

from backend.app.database import db
from backend.app.services.weather_fetcher import fetch_wind_grid

logger = logging.getLogger(__name__)

# Romania core: step=2.0° → n_lat=3, n_lon=6 → 18 points per altitude
REGIONS = [
    # (name, min_lat, max_lat, min_lon, max_lon, step_deg)
    ("romania_core", 43.5, 49.0, 19.5, 31.0, 2.0),
]
ALTITUDES = [0, 500, 1000, 1500, 2000, 3000]

_CYCLE_S = 3600          # refresh every 1 hour
_INTER_CALL_S = 30       # 30s between altitude calls within one cycle
_BACKOFF_429_S = 3600    # if 429, skip rest and retry in 1 hour

_timer: threading.Timer | None = None


class _RateLimited(Exception):
    pass


def _fetch_and_store(region_name, min_lat, max_lat, min_lon, max_lon, step, alt, valid_for):
    grid = fetch_wind_grid(min_lat, max_lat, min_lon, max_lon, step, alt)

    if not grid:
        # fetch_wind_grid already logged the 429; surface it so the cycle can abort
        raise _RateLimited(f"{region_name} alt={alt}")

    with db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO weather.wind_grid_cache
                (region, altitude_m, valid_for,
                 min_lat, max_lat, min_lon, max_lon,
                 step_deg, point_count, grid_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (region, altitude_m, valid_for) DO UPDATE
                SET fetched_at  = now(),
                    point_count = EXCLUDED.point_count,
                    grid_data   = EXCLUDED.grid_data
        """, (
            region_name, alt, valid_for,
            min_lat, max_lat, min_lon, max_lon,
            step, len(grid),
            json.dumps(grid),
        ))
    logger.info("ingestion: stored %d pts %s alt=%d", len(grid), region_name, alt)


def run_ingestion() -> float:
    """Run one ingestion cycle. Returns the delay in seconds before the next cycle."""
    valid_for = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    for region_name, min_lat, max_lat, min_lon, max_lon, step in REGIONS:
        for i, alt in enumerate(ALTITUDES):
            if i > 0:
                time.sleep(_INTER_CALL_S)
            try:
                _fetch_and_store(region_name, min_lat, max_lat, min_lon, max_lon,
                                 step, alt, valid_for)
            except _RateLimited as exc:
                logger.warning("ingestion: 429/empty for %s — aborting cycle, retry in %ds", exc, _BACKOFF_429_S)
                return _BACKOFF_429_S
            except Exception as exc:
                logger.error("ingestion: DB write failed %s alt=%d: %s", region_name, alt, exc)

    return _CYCLE_S


def _run_and_reschedule() -> None:
    global _timer
    next_delay = run_ingestion()
    _timer = threading.Timer(next_delay, _run_and_reschedule)
    _timer.daemon = True
    _timer.start()


def start_ingestion(delay_s: float = 5.0) -> None:
    global _timer
    _timer = threading.Timer(delay_s, _run_and_reschedule)
    _timer.daemon = True
    _timer.start()
    logger.info("ingestion: first run in %.0fs", delay_s)


def query_cached_wind_grid(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    altitude_m: int,
    max_age_s: int = 7200,
) -> list[dict] | None:
    """Return DB-cached wind grid points covering the bbox, or None if stale/missing."""
    try:
        with db() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT grid_data
                FROM weather.wind_grid_cache
                WHERE altitude_m = %s
                  AND fetched_at > now() - make_interval(secs => %s)
                  AND min_lat <= %s AND max_lat >= %s
                  AND min_lon <= %s AND max_lon >= %s
                ORDER BY fetched_at DESC
                LIMIT 1
            """, (altitude_m, max_age_s, min_lat, max_lat, min_lon, max_lon))
            row = cur.fetchone()
            if not row:
                return None
            all_points = row[0] if isinstance(row[0], list) else json.loads(row[0])
            return [
                p for p in all_points
                if min_lat <= p["lat"] <= max_lat and min_lon <= p["lon"] <= max_lon
            ]
    except Exception as exc:
        logger.warning("query_cached_wind_grid: %s", exc)
        return None
