from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.app.data.seed import demo_weather
from backend.app.services.recommendations import get_site
from backend.app.services.weather_fetcher import fetch_site_weather

router = APIRouter(prefix="/v1/weather", tags=["weather"])


@router.get("/sites/{site_id}/hourly")
def site_hourly_weather(site_id: UUID, days: int = Query(1, ge=1, le=5)):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    weather = fetch_site_weather(site.lat, site.lon, site.altitude_m, days=days)
    return weather or demo_weather(site_id)
