from fastapi import APIRouter

router = APIRouter(prefix="/v1/mobile", tags=["mobile"])


@router.get("/bootstrap")
def bootstrap():
    return {
        "min_version": "0.1.0",
        "feature_flags": {
            "map": True,
            "site_recommendations": True,
            "ai_briefings": True,
            "tracking": False,
            "offline_packages": False,
        },
        "entitlements": {
            "free": ["basic_wind", "gust", "rain", "launch_markers", "3_day_forecast"],
            "pro": ["thermals", "cloudbase", "flyability_timeline", "offline_basic"],
            "pro_plus": ["model_comparison", "corrected_forecast", "route_weather", "ai_briefing"],
        },
    }

