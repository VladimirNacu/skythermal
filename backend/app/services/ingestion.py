"""
Background wind-grid ingestion: pre-fetches Open-Meteo wind data every 30 minutes
for Romania (fine) and Europe (coarse) at 6 altitudes, stores results in PostgreSQL.
User requests are served from DB cache instead of hitting Open-Meteo in real-time.
"""
import json
import logging
import threading
import time
from datetime import datetime, timezone

from backend.app.database import db
from backend.app.services.weather_fetcher import fetch_wind_grid

logger = logging.getLogger(__name__)

REGIONS = [
    # (name, min_lat, max_lat, min_lon, max_lon, step_deg)
    # step=1.0 → 91 pts;  step=4.0 → 140 pts — both safely under the 200-pt cap
    ("romania_detail", 43.5,  49.0, 19.5,  31.0, 1.0),
    ("europe_wide",    35.0,  72.0, -12.0, 42.0, 4.0),
]
ALTITUDES = [0, 500, 1000, 1500, 2000, 3000]

_timer: threading.Timer | None = None

_INTER_CALL_DELAY_S = 12  # seconds between consecutive Open-Meteo batch calls


def run_ingestion() -> None:
    valid_for = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for region_name, min_lat, max_lat, min_lon, max_lon, step in REGIONS:
        for alt in ALTITUDES:
            try:
                grid = fetch_wind_grid(min_lat, max_lat, min_lon, max_lon, step, alt)
                if not grid:
                    logger.warning("ingestion: empty result %s alt=%d", region_name, alt)
                    continue
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
            except Exception as exc:
                logger.error("ingestion: failed %s alt=%d: %s", region_name, alt, exc)
            finally:
                time.sleep(_INTER_CALL_DELAY_S)


def _reschedule() -> None:
    global _timer
    _timer = threading.Timer(1800, _run_and_reschedule)
    _timer.daemon = True
    _timer.start()


def _run_and_reschedule() -> None:
    try:
        run_ingestion()
    finally:
        _reschedule()


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
    max_age_s: int = 2100,
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
