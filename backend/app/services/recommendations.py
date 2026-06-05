from math import atan2, cos, radians, sin, sqrt
from uuid import UUID

from backend.app.data.seed import SITES, demo_weather
from backend.app.models import DecisionStatus, PilotProfile, SiteRecommendation
from backend.app.services.flyability import score_timeline


def distance_km(lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
    radius = 6371.0
    dlat = radians(lat_b - lat_a)
    dlon = radians(lon_b - lon_a)
    a = sin(dlat / 2) ** 2 + cos(radians(lat_a)) * cos(radians(lat_b)) * sin(dlon / 2) ** 2
    return radius * 2 * atan2(sqrt(a), sqrt(1 - a))


def get_site(site_id: UUID):
    return next((site for site in SITES if site.id == site_id), None)


def recommendations(lat: float, lon: float, radius_km: float, pilot: PilotProfile) -> list[SiteRecommendation]:
    results: list[SiteRecommendation] = []
    for site in SITES:
        distance = distance_km(lat, lon, site.lat, site.lon)
        if distance > radius_km:
            continue
        timeline = score_timeline(site, demo_weather(site.id), pilot)
        best = max(timeline, key=lambda item: (item.status != DecisionStatus.NO_GO, item.safety_score, item.flyability_score))
        blockers = [blocker.message for blocker in best.blockers]
        results.append(
            SiteRecommendation(
                site_id=site.id,
                name=site.name,
                distance_km=round(distance, 1),
                status=best.status,
                flyability_score=best.flyability_score,
                safety_score=best.safety_score,
                xc_score=max(0, min(100, best.flyability_score + 4)),
                best_window={"start": best.valid_time, "end": best.valid_time},
                top_reasons=best.explanation[:3],
                blockers=blockers,
            )
        )

    status_rank = {DecisionStatus.GO: 0, DecisionStatus.MAYBE: 1, DecisionStatus.UNKNOWN: 2, DecisionStatus.NO_GO: 3}
    return sorted(results, key=lambda item: (status_rank[item.status], -item.safety_score, -item.flyability_score, item.distance_km))

