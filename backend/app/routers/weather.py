from uuid import UUID

from fastapi import APIRouter, HTTPException

from backend.app.data.seed import demo_weather
from backend.app.services.recommendations import get_site

router = APIRouter(prefix="/v1/weather", tags=["weather"])


@router.get("/sites/{site_id}/hourly")
def site_hourly_weather(site_id: UUID):
    site = get_site(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return demo_weather(site_id)

