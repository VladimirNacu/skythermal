from uuid import UUID

from fastapi import APIRouter, HTTPException

from backend.app.data.seed import demo_weather
from backend.app.models import PilotLevel, PilotProfile
from backend.app.services.flyability import score_timeline
from backend.app.services.recommendations import get_site

router = APIRouter(prefix="/v1/flyability", tags=["flyability"])


@router.get("/sites/{site_id}/timeline")
def site_flyability_timeline(site_id: UUID, pilot_level: PilotLevel = PilotLevel.intermediate):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return score_timeline(site, demo_weather(site_id), PilotProfile(pilot_level=pilot_level))

