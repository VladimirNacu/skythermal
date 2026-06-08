from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from backend.app.services.tile_renderer import RAMPS, render_tile

router = APIRouter(prefix="/v1/tiles", tags=["tiles"])

SUPPORTED = set(RAMPS.keys())


@router.get("/{overlay}/{z}/{x}/{y}.png")
def weather_tile(
    overlay: str,
    z: int,
    x: int,
    y: int,
    time: str | None = Query(None, description="ISO-8601 UTC hour, e.g. 2026-06-07T11:00:00Z"),
    altitude_m: int  = Query(0, ge=0, le=5000),
):
    if overlay not in SUPPORTED:
        raise HTTPException(status_code=404, detail=f"Unknown overlay '{overlay}'")
    if not (0 <= z <= 14 and 0 <= x < 2**z and 0 <= y < 2**z):
        raise HTTPException(status_code=400, detail="Invalid tile coordinates")

    png = render_tile(overlay, z, x, y, time_iso=time, altitude_m=altitude_m)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=1800",
            "Access-Control-Allow-Origin": "*",
        },
    )
