from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from backend.app.data.seed import SITES
from backend.app.models import PilotLevel, PilotProfile
from backend.app.services.recommendations import get_site, recommendations

router = APIRouter(prefix="/v1/sites", tags=["sites"])


@router.get("")
def list_sites(
    country_code: str | None = None,
    q: str | None = Query(None, description="Search by name or region (case-insensitive)"),
):
    sites = SITES
    if country_code:
        sites = [s for s in sites if s.country_code == country_code.upper()]
    if q:
        q_lower = q.lower()
        sites = [s for s in sites if q_lower in s.name.lower() or q_lower in s.region.lower()]
    return sites


@router.get("/recommendations")
def site_recommendations(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(300, gt=0, le=2000),
    pilot_level: PilotLevel = PilotLevel.intermediate,
):
    return recommendations(lat, lon, radius_km, PilotProfile(pilot_level=pilot_level))


@router.get("/{site_id}")
def site_detail(site_id: UUID):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site
