from datetime import datetime, timezone

from backend.app.config import settings
from backend.app.data.seed import demo_weather
from backend.app.models import BriefingRequest, BriefingResponse, DecisionStatus, GroundedFact
from backend.app.services.flyability import score_timeline
from backend.app.services.recommendations import get_site
from backend.app.services.weather_fetcher import fetch_site_weather


def build_briefing(request: BriefingRequest) -> BriefingResponse:
    now = datetime.now(timezone.utc)

    if request.site_id is None:
        return BriefingResponse(
            answer="No launch site selected — choose a site to receive a grounded briefing.",
            recommendation=DecisionStatus.UNKNOWN,
            confidence=0.2,
            grounded_facts=[],
            blockers=[],
            follow_up_actions=["Select a launch site", "Use Find Sites Near Me"],
            generated_at=now,
            safety_footer=settings.safety_disclaimer,
        )

    site = get_site(request.site_id)
    if site is None:
        return BriefingResponse(
            answer="Site not found in the launch catalog.",
            recommendation=DecisionStatus.UNKNOWN,
            confidence=0.1,
            grounded_facts=[],
            blockers=[],
            follow_up_actions=["Verify the site ID", "Refresh the launch catalog"],
            generated_at=now,
            safety_footer=settings.safety_disclaimer,
        )

    weather = fetch_site_weather(site.lat, site.lon, site.altitude_m, days=1) or demo_weather(site.id)
    timeline = score_timeline(site, weather, request.pilot_profile)
    decision = timeline[0]
    model_src = weather[0].model if weather else "demo"

    facts = [
        GroundedFact(
            source="launch_catalog",
            observed_at=now,
            fact=f"{site.name}: altitude {site.altitude_m} m, safe sectors {', '.join(site.safe_directions)}.",
        ),
        GroundedFact(
            source=f"forecast.{model_src}",
            observed_at=weather[0].model_run_time if weather else now,
            fact=f"Wind {decision.wind_kmh:.0f} km/h from {decision.wind_direction_deg}°, gust {decision.gust_kmh:.0f} km/h, cloudbase {decision.cloudbase_msl_m} m MSL.",
        ),
        GroundedFact(
            source="flyability_engine.v1",
            observed_at=now,
            fact=f"Decision {decision.status}: flyability {decision.flyability_score}/100, safety {decision.safety_score}/100.",
        ),
    ]

    if decision.status == DecisionStatus.NO_GO:
        hard = [b.message for b in decision.blockers if b.severity == "hard"]
        answer = f"NO-GO for {site.name}. " + " ".join(hard)
        actions = ["Do not launch — conditions exceed limits", "Check later windows", "Review nearby sites"]
    elif decision.status == DecisionStatus.MAYBE:
        answer = f"MAYBE for {site.name}. Conditions need on-site verification. " + " ".join(decision.explanation[:2])
        actions = ["Check live windsock on arrival", "Review all hazards", "Set a change alert for GO status"]
    else:
        answer = f"GO candidate for {site.name}. " + " ".join(decision.explanation[:2])
        actions = ["Verify actual launch conditions on arrival", "Check landing field before launch", "File a flight plan"]

    return BriefingResponse(
        answer=answer,
        recommendation=decision.status,
        confidence=decision.confidence,
        grounded_facts=facts if request.include_sources else [],
        blockers=decision.blockers,
        follow_up_actions=actions,
        generated_at=now,
        safety_footer=settings.safety_disclaimer,
    )
