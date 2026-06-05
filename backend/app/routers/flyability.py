from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.app.data.seed import demo_weather
from backend.app.models import PilotLevel, PilotProfile
from backend.app.services.flyability import score_timeline
from backend.app.services.recommendations import get_site
from backend.app.services.weather_fetcher import fetch_site_weather

router = APIRouter(prefix="/v1/flyability", tags=["flyability"])


@router.get("/sites/{site_id}/timeline")
def site_flyability_timeline(
    site_id: UUID,
    pilot_level: PilotLevel = PilotLevel.intermediate,
    days: int = Query(1, ge=1, le=5),
):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    weather = fetch_site_weather(site.lat, site.lon, site.altitude_m, days=days) or demo_weather(site_id)
    return score_timeline(site, weather, PilotProfile(pilot_level=pilot_level))
