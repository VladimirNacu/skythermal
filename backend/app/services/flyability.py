from backend.app.models import Blocker, DecisionStatus, FlyabilityHour, LaunchSite, PilotProfile, WeatherHour


def direction_label(degrees: int) -> str:
    labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return labels[round(degrees / 45) % 8]


def score_hour(site: LaunchSite, weather: WeatherHour, pilot: PilotProfile) -> FlyabilityHour:
    blockers: list[Blocker] = []
    reasons: list[str] = []
    safety_score = 100
    flyability_score = 100

    wind_label = direction_label(weather.wind_direction_deg)
    if wind_label not in site.safe_directions:
        blockers.append(Blocker(code="UNSAFE_DIRECTION", severity="hard", message=f"Wind {wind_label} is outside safe sectors {', '.join(site.safe_directions)}."))
        safety_score -= 45
        flyability_score -= 35
    else:
        reasons.append(f"Wind direction {wind_label} is within the site safe sector.")

    if weather.wind_kmh > pilot.max_wind_kmh:
        blockers.append(Blocker(code="WIND_LIMIT", severity="hard", message=f"Wind {weather.wind_kmh:.0f} km/h exceeds pilot limit {pilot.max_wind_kmh} km/h."))
        safety_score -= 45
        flyability_score -= 40
    elif weather.wind_kmh > pilot.max_wind_kmh * 0.8:
        blockers.append(Blocker(code="WIND_MARGIN", severity="warning", message="Wind is close to the pilot limit."))
        safety_score -= 18
        flyability_score -= 15
    else:
        reasons.append(f"Wind {weather.wind_kmh:.0f} km/h is inside pilot limit.")

    if weather.gust_kmh > pilot.max_gust_kmh:
        blockers.append(Blocker(code="GUST_LIMIT", severity="hard", message=f"Gust {weather.gust_kmh:.0f} km/h exceeds pilot limit {pilot.max_gust_kmh} km/h."))
        safety_score -= 50
        flyability_score -= 45
    elif weather.gust_kmh - weather.wind_kmh > 12:
        blockers.append(Blocker(code="GUST_SPREAD", severity="warning", message="Gust spread suggests variable launch conditions."))
        safety_score -= 16
        flyability_score -= 12

    min_cloudbase = site.altitude_m + 250
    if weather.cloudbase_msl_m < min_cloudbase:
        blockers.append(Blocker(code="LOW_CLOUDBASE", severity="hard", message=f"Cloudbase {weather.cloudbase_msl_m} m is below safe margin {min_cloudbase} m."))
        safety_score -= 40
        flyability_score -= 30

    if weather.storm_risk >= 60:
        blockers.append(Blocker(code="STORM_RISK", severity="hard", message=f"Storm risk {weather.storm_risk}% is a hard blocker."))
        safety_score = min(safety_score, 20)
        flyability_score = min(flyability_score, 15)
    elif weather.storm_risk >= 30:
        blockers.append(Blocker(code="STORM_WATCH", severity="warning", message="Convective risk requires active monitoring."))
        safety_score -= 22

    if weather.rain_mm > 0.5:
        blockers.append(Blocker(code="PRECIPITATION", severity="hard", message="Rain is incompatible with normal paragliding operations."))
        safety_score -= 50
        flyability_score -= 45

    if weather.thermal_strength_ms:
        flyability_score += min(8, int(weather.thermal_strength_ms * 3))
        reasons.append(f"Thermal estimate {weather.thermal_strength_ms:.1f} m/s supports usable lift.")

    safety_score = max(0, min(100, safety_score))
    flyability_score = max(0, min(100, flyability_score))
    hard_blockers = [blocker for blocker in blockers if blocker.severity == "hard"]

    if hard_blockers:
        status = DecisionStatus.NO_GO
    elif safety_score < 70 or flyability_score < 70:
        status = DecisionStatus.MAYBE
    else:
        status = DecisionStatus.GO

    explanation = reasons + [blocker.message for blocker in blockers]
    return FlyabilityHour(
        valid_time=weather.valid_time,
        status=status,
        flyability_score=flyability_score,
        safety_score=safety_score,
        confidence=0.82 if status != DecisionStatus.UNKNOWN else 0.3,
        wind_kmh=weather.wind_kmh,
        gust_kmh=weather.gust_kmh,
        wind_direction_deg=weather.wind_direction_deg,
        cloudbase_msl_m=weather.cloudbase_msl_m,
        thermal_strength_ms=weather.thermal_strength_ms,
        blockers=blockers,
        explanation=explanation[:3],
    )


def score_timeline(site: LaunchSite, weather: list[WeatherHour], pilot: PilotProfile) -> list[FlyabilityHour]:
    return [score_hour(site, hour, pilot) for hour in weather]

