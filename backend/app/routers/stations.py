from uuid import UUID

from fastapi import APIRouter

from backend.app.models import StationUplink

router = APIRouter(prefix="/v1/stations", tags=["stations"])


@router.post("/{station_id}/uplinks", status_code=202)
def station_uplink(station_id: UUID, uplink: StationUplink):
    return {
        "accepted": station_id == uplink.station_id,
        "station_id": station_id,
        "observed_at": uplink.observed_at,
        "quality_flags": [],
    }

