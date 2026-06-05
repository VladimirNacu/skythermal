from datetime import datetime, timezone

from backend.app.config import settings
from backend.app.data.seed import demo_weather
from backend.app.models import BriefingRequest, BriefingResponse, DecisionStatus, GroundedFact
from backend.app.services.flyability import score_timeline
from backend.app.services.recommendations import get_site


def build_briefing(request: BriefingRequest) -> BriefingResponse:
    generated_at = datetime.now(timezone.utc)
    if request.site_id is None:
        return BriefingResponse(
            answer="UNKNOWN: choose a launch site so the briefing can be grounded in site rules, weather, and hazards.",
            recommendation=DecisionStatus.UNKNOWN,
            confidence=0.2,
            grounded_facts=[],
            blockers=[],
            follow_up_actions=["Select a launch site", "Check nearby recommendations"],
            generated_at=generated_at,
            safety_footer=settings.safety_disclaimer,
        )

    site = get_site(request.site_id)
    if site is None:
        return BriefingResponse(
            answer="UNKNOWN: site was not found in the launch catalog.",
            recommendation=DecisionStatus.UNKNOWN,
            confidence=0.1,
            grounded_facts=[],
            blockers=[],
            follow_up_actions=["Verify the site id", "Refresh the launch catalog"],
            generated_at=generated_at,
            safety_footer=settings.safety_disclaimer,
        )

    weather = demo_weather(site.id)
    timeline = score_timeline(site, weather, request.pilot_profile)
    decision = timeline[0]
    facts = [
        GroundedFact(source="launch_catalog", observed_at=generated_at, fact=f"{site.name} safe sectors: {', '.join(site.safe_directions)}."),
        GroundedFact(source="forecast.demo-best", observed_at=weather[0].model_run_time, fact=f"Wind {decision.wind_kmh:.0f} km/h, gust {decision.gust_kmh:.0f} km/h, cloudbase {decision.cloudbase_msl_m} m."),
        GroundedFact(source="flyability_engine.v0", observed_at=generated_at, fact=f"Decision {decision.status} with safety score {decision.safety_score}."),
    ]
    if decision.status == DecisionStatus.NO_GO:
        answer = f"NO-GO for {site.name}. Hard blockers are present: " + " ".join(blocker.message for blocker in decision.blockers if blocker.severity == "hard")
        actions = ["Do not launch based on this window", "Compare later windows", "Check live station data at launch"]
    elif decision.status == DecisionStatus.MAYBE:
        answer = f"MAYBE for {site.name}. Conditions need local verification: " + " ".join(decision.explanation)
        actions = ["Check windsock and station observations", "Review hazards", "Set a change alert"]
    else:
        answer = f"GO candidate for {site.name}, within the provided pilot limits. " + " ".join(decision.explanation)
        actions = ["Verify actual launch conditions", "Review landing options", "Save briefing"]

    return BriefingResponse(
        answer=answer,
        recommendation=decision.status,
        confidence=decision.confidence,
        grounded_facts=facts if request.include_sources else [],
        blockers=decision.blockers,
        follow_up_actions=actions,
        generated_at=generated_at,
        safety_footer=settings.safety_disclaimer,
    )

