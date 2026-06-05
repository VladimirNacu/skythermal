from math import atan2, cos, radians, sin, sqrt
from uuid import UUID

from backend.app.data.seed import SITES, demo_weather
from backend.app.models import DecisionStatus, PilotProfile, SiteRecommendation
from backend.app.services.flyability import score_timeline
from backend.app.services.weather_fetcher import fetch_site_weather


def distance_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    R = 6371.0
    dlat = radians(lat_b - lat_a)
    dlon = radians(lon_b - lon_a)
    a = sin(dlat / 2) ** 2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def get_site(site_id: UUID):
    return next((s for s in SITES if s.id == site_id), None)


def recommendations(lat: float, lon: float, radius_km: float, pilot: PilotProfile) -> list[SiteRecommendation]:
    results: list[SiteRecommendation] = []
    for site in SITES:
        dist = distance_km(lat, lon, site.lat, site.lon)
        if dist > radius_km:
            continue
        weather = fetch_site_weather(site.lat, site.lon, site.altitude_m, days=1) or demo_weather(site.id)
        timeline = score_timeline(site, weather, pilot)
        best = max(timeline, key=lambda h: (h.status != DecisionStatus.NO_GO, h.safety_score, h.flyability_score))
        results.append(SiteRecommendation(
            site_id=site.id,
            name=site.name,
            distance_km=round(dist, 1),
            status=best.status,
            flyability_score=best.flyability_score,
            safety_score=best.safety_score,
            xc_score=max(0, min(100, best.flyability_score + 4)),
            best_window={"start": best.valid_time, "end": best.valid_time},
            top_reasons=best.explanation[:3],
            blockers=[b.message for b in best.blockers],
        ))

    rank = {DecisionStatus.GO: 0, DecisionStatus.MAYBE: 1, DecisionStatus.UNKNOWN: 2, DecisionStatus.NO_GO: 3}
    return sorted(results, key=lambda r: (rank[r.status], -r.safety_score, -r.flyability_score, r.distance_km))
