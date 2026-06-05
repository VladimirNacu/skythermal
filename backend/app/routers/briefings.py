from fastapi import APIRouter

from backend.app.models import BriefingRequest, BriefingResponse
from backend.app.services.briefing import build_briefing

router = APIRouter(prefix="/v1/briefings", tags=["briefings"])


@router.post("/site", response_model=BriefingResponse)
def create_site_briefing(request: BriefingRequest):
    return build_briefing(request)

