from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.app.data.seed import demo_weather
from backend.app.services.recommendations import get_site
from backend.app.services.weather_fetcher import fetch_site_weather, fetch_wind_grid

router = APIRouter(prefix="/v1/weather", tags=["weather"])


@router.get("/sites/{site_id}/hourly")
def site_hourly_weather(site_id: UUID, days: int = Query(1, ge=1, le=5)):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    weather = fetch_site_weather(site.lat, site.lon, site.altitude_m, days=days, country_code=site.country_code)
    return weather or demo_weather(site_id)


@router.get("/wind-grid")
def wind_grid_endpoint(
    min_lat:    float = Query(..., ge=-90,  le=90),
    max_lat:    float = Query(..., ge=-90,  le=90),
    min_lon:    float = Query(..., ge=-180, le=180),
    max_lon:    float = Query(..., ge=-180, le=180),
    step:       float = Query(1.0, ge=0.25, le=3.0),
    altitude_m: int   = Query(0,   ge=0,   le=5000),
):
    grid     = fetch_wind_grid(min_lat, max_lat, min_lon, max_lon, step, altitude_m)
    now      = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return {"grid": grid, "valid_time": now.isoformat()}
