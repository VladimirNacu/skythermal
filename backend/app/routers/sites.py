from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.app.data.seed import SITES
from backend.app.models import PilotLevel, PilotProfile
from backend.app.services.recommendations import get_site, recommendations

router = APIRouter(prefix="/v1/sites", tags=["sites"])


@router.get("")
def list_sites(country_code: str | None = None):
    sites = SITES
    if country_code:
        sites = [site for site in sites if site.country_code == country_code.upper()]
    return sites


@router.get("/recommendations")
def site_recommendations(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(180, gt=0, le=1000),
    pilot_level: PilotLevel = PilotLevel.intermediate,
):
    pilot = PilotProfile(pilot_level=pilot_level)
    return recommendations(lat, lon, radius_km, pilot)


@router.get("/{site_id}")
def site_detail(site_id: UUID):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site

