from datetime import datetime, timedelta, timezone
from uuid import UUID

from backend.app.models import LaunchSite, PilotLevel, WeatherHour

# ─── Site IDs — Romania (Carpathians / Transylvania) first ────────────────────
BUNLOC_ID     = UUID("b0000001-0000-4000-8000-000000000001")
POSTAVARU_ID  = UUID("b0000002-0000-4000-8000-000000000002")
LEMPES_ID     = UUID("b0000003-0000-4000-8000-000000000003")
SINAIA_ID     = UUID("b0000004-0000-4000-8000-000000000004")
CLOPOTIVA_ID  = UUID("b0000005-0000-4000-8000-000000000005")
RIMETEA_ID    = UUID("b0000006-0000-4000-8000-000000000006")
# Romania — Maramureș / Baia Mare area
CREASTA_ID    = UUID("aa000001-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
MOGOSA_ID     = UUID("aa000002-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
CAVNIC_ID     = UUID("aa000003-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
BORSA_ID      = UUID("aa000004-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
# Norway
VAGA_ID       = UUID("11111111-1111-4111-8111-111111111111")
HAFJELL_ID    = UUID("22222222-2222-4222-8222-222222222222")
VOSS_ID       = UUID("33333333-3333-4333-8333-333333333333")
GAUSTATOPPEN_ID = UUID("44444444-4444-4444-8444-444444444444")
NESAKSLA_ID   = UUID("55555555-5555-4555-8555-555555555555")
SOGNDAL_ID    = UUID("66666666-6666-4666-8666-666666666666")
HEMSEDAL_ID   = UUID("77777777-7777-4777-8777-777777777777")
LYNGEN_ID     = UUID("88888888-8888-4888-8888-888888888888")

SITES = [
    # ─── Romania — Carpathians / Transylvania (default region) ───────────────
    LaunchSite(
        id=BUNLOC_ID,
        name="Bunloc",
        country_code="RO",
        region="Brașov",
        lat=45.638,
        lon=25.678,
        altitude_m=950,
        difficulty=PilotLevel.intermediate,
        safe_directions=["NW", "W", "SW", "N"],
        hazards=["Valley wind acceleration in afternoon", "Restricted airspace — CTR Brașov, check NOTAM", "Rotor risk in strong E/NE winds"],
        local_rules=["Validate with ROMATSA/AIS Romania before XC flights", "All site data must be confirmed with local pilots before GO recommendations"],
    ),
    LaunchSite(
        id=POSTAVARU_ID,
        name="Postăvaru / Poiana Brașov",
        country_code="RO",
        region="Brașov",
        lat=45.577,
        lon=25.554,
        altitude_m=1700,
        difficulty=PilotLevel.xc,
        safe_directions=["W", "NW", "SW"],
        hazards=["Ski infrastructure active Oct–Apr", "Cloud base drops fast in Carpathian winter", "Strong Foehn effect on leeward side"],
        local_rules=["Coordinate with Poiana Brașov ski resort management in season"],
    ),
    LaunchSite(
        id=LEMPES_ID,
        name="Lempeș Hill",
        country_code="RO",
        region="Brașov",
        lat=45.640,
        lon=25.572,
        altitude_m=680,
        difficulty=PilotLevel.beginner,
        safe_directions=["NW", "W", "N", "NE"],
        hazards=["High-tension power lines along northern valley edge", "Thermal activity stronger than expected for altitude"],
        local_rules=["Training hill — coordinate with Aeroclub Brașov before first flight"],
    ),
    LaunchSite(
        id=SINAIA_ID,
        name="Sinaia / Bucegi",
        country_code="RO",
        region="Prahova Valley",
        lat=45.352,
        lon=25.554,
        altitude_m=1400,
        difficulty=PilotLevel.intermediate,
        safe_directions=["W", "NW", "SW"],
        hazards=["Bucegi Massif creates strong orographic lift and turbulence", "Rapid afternoon overdevelopment", "High-speed valley winds in Prahova corridor"],
        local_rules=["Contact local Sinaia paragliding club", "Validate with ROMATSA — Bucharest FIR airspace applies"],
    ),
    LaunchSite(
        id=CLOPOTIVA_ID,
        name="Clopotiva / Retezat",
        country_code="RO",
        region="Retezat / Hunedoara",
        lat=45.371,
        lon=22.784,
        altitude_m=870,
        difficulty=PilotLevel.xc,
        safe_directions=["N", "NE", "NW"],
        hazards=["Retezat National Park — restricted landing inside park boundary", "Remote terrain, limited rescue access", "Bear activity in wooded launch area"],
        local_rules=["File intent with Salvamont Hunedoara", "XC pilots carry emergency bivy — terrain is remote"],
    ),
    LaunchSite(
        id=RIMETEA_ID,
        name="Rimetea / Apuseni",
        country_code="RO",
        region="Apuseni / Alba",
        lat=46.459,
        lon=23.895,
        altitude_m=1020,
        difficulty=PilotLevel.intermediate,
        safe_directions=["SW", "S", "SE", "W"],
        hazards=["Karst terrain below — few safe landing fields", "Apuseni thermal cycle very active midday", "Weather changes quickly in the western mountains"],
        local_rules=["Coordinate with Aeroclub Alba Iulia", "Validate airspace with ROMATSA before flight"],
    ),
    # ─── Romania — Maramureș / Baia Mare ─────────────────────────────────────
    LaunchSite(
        id=CREASTA_ID,
        name="Creasta Cocoșului",
        country_code="RO",
        region="Maramureș",
        lat=47.710,
        lon=23.530,
        altitude_m=1428,
        difficulty=PilotLevel.intermediate,
        safe_directions=["N", "NW", "NE", "W"],
        hazards=["Rotor behind Gutâi ridge in strong S winds", "Fog forms quickly in the valley below", "Restricted forest landing zones"],
        local_rules=["Contact Baia Mare Paragliding Club before first flight of the season"],
    ),
    LaunchSite(
        id=MOGOSA_ID,
        name="Mogoșa Launch",
        country_code="RO",
        region="Maramureș",
        lat=47.608,
        lon=23.511,
        altitude_m=1246,
        difficulty=PilotLevel.beginner,
        safe_directions=["NW", "W", "N"],
        hazards=["Ski infrastructure active Oct–Apr", "Valley inversions trap thermals below 1000 m MSL in morning"],
        local_rules=["Coordinate with ski patrol during winter season"],
    ),
    LaunchSite(
        id=CAVNIC_ID,
        name="Cavnic Paragliding Hill",
        country_code="RO",
        region="Maramureș",
        lat=47.655,
        lon=23.886,
        altitude_m=900,
        difficulty=PilotLevel.beginner,
        safe_directions=["W", "SW", "NW"],
        hazards=["Mining infrastructure on adjacent hillside", "Low-level turbulence from valley factories"],
        local_rules=["No flight path over active mining area to the NE"],
    ),
    LaunchSite(
        id=BORSA_ID,
        name="Borșa–Rodnei Ridge",
        country_code="RO",
        region="Maramureș",
        lat=47.654,
        lon=24.648,
        altitude_m=1380,
        difficulty=PilotLevel.xc,
        safe_directions=["N", "NW", "NE"],
        hazards=["Rodnei National Park — restricted landing zones inside park boundary", "Rapid afternoon convection in summer", "Bear activity in wooded launch areas"],
        local_rules=["XC pilots must carry emergency bivy — terrain is remote", "File intent with local mountain rescue (Salvamont Borșa)"],
    ),
    # ─── Norway ───────────────────────────────────────────────────────────────
    LaunchSite(
        id=VAGA_ID,
        name="Vågå Launch",
        country_code="NO",
        region="Gudbrandsdalen",
        lat=61.875,
        lon=9.096,
        altitude_m=940,
        difficulty=PilotLevel.intermediate,
        safe_directions=["NW", "N", "NE"],
        hazards=["Rotor in strong westerly flow", "Power lines near lower landing"],
        local_rules=["Check local club notices before launching"],
    ),
    LaunchSite(
        id=HAFJELL_ID,
        name="Hafjell Ridge",
        country_code="NO",
        region="Innlandet",
        lat=61.247,
        lon=10.447,
        altitude_m=1030,
        difficulty=PilotLevel.beginner,
        safe_directions=["S", "SW", "SE"],
        hazards=["Thermal turbulence over tree line"],
        local_rules=[],
    ),
    LaunchSite(
        id=VOSS_ID,
        name="Voss Hanguren",
        country_code="NO",
        region="Vestland",
        lat=60.632,
        lon=6.414,
        altitude_m=660,
        difficulty=PilotLevel.xc,
        safe_directions=["W", "NW", "SW"],
        hazards=["Fast valley wind changes", "Busy airspace on event days"],
        local_rules=[],
    ),
    LaunchSite(
        id=GAUSTATOPPEN_ID,
        name="Gaustablikk Launch",
        country_code="NO",
        region="Telemark",
        lat=59.854,
        lon=8.648,
        altitude_m=1350,
        difficulty=PilotLevel.xc,
        safe_directions=["W", "NW", "SW", "N"],
        hazards=["Strong thermal activity in summer", "Sudden valley inversions", "Cable car zone — check NOTAM"],
        local_rules=["Coordinate with Gaustatoppen cable car operator on busy days"],
    ),
    LaunchSite(
        id=NESAKSLA_ID,
        name="Nesaksla (Åndalsnes)",
        country_code="NO",
        region="Romsdalen",
        lat=62.566,
        lon=7.686,
        altitude_m=715,
        difficulty=PilotLevel.intermediate,
        safe_directions=["N", "NW", "NE"],
        hazards=["Severe rotor risk below Romsdalseggen ridge", "Fast-developing valley outflow in afternoon"],
        local_rules=["Land at Åndalsnes sports field only", "No flying over town centre"],
    ),
    LaunchSite(
        id=SOGNDAL_ID,
        name="Kaupanger Ridge",
        country_code="NO",
        region="Vestland",
        lat=61.229,
        lon=7.095,
        altitude_m=720,
        difficulty=PilotLevel.intermediate,
        safe_directions=["SE", "S", "SW"],
        hazards=["Fjord katabatic winds after sunset", "Restricted airspace near Sogndal airport"],
        local_rules=["Contact Sogndal aerodrome (ENSG) before flying — CTR applies below 2500 ft"],
    ),
    LaunchSite(
        id=HEMSEDAL_ID,
        name="Hemsedal Totten",
        country_code="NO",
        region="Viken",
        lat=60.864,
        lon=8.569,
        altitude_m=1097,
        difficulty=PilotLevel.beginner,
        safe_directions=["NE", "N", "NW", "E"],
        hazards=["Ski patrol activity in winter", "Rotor below Totten summit in W winds"],
        local_rules=["School training site — non-school pilots register with resort"],
    ),
    LaunchSite(
        id=LYNGEN_ID,
        name="Lyngen Alps Launch",
        country_code="NO",
        region="Troms",
        lat=69.759,
        lon=20.194,
        altitude_m=820,
        difficulty=PilotLevel.xc,
        safe_directions=["W", "SW", "NW"],
        hazards=["Rapid weather changes — Arctic exposure", "Limited landing options in fjord terrain", "Polar bears outside main season"],
        local_rules=["Inform local rescue coordination (HRS Nord) for remote XC flights"],
    ),
]

# ─── ID → site lookup used by routers ────────────────────────────────────────
SITE_BY_ID = {s.id: s for s in SITES}

# ─── Demo weather fallback (used when Open-Meteo is unreachable) ──────────────
_DEMO_PROFILES = {
    BUNLOC_ID:      [(10, 18, 315, 1900, 2.1, 0,  8), (13, 22, 305, 1850, 2.8, 0, 10), (15, 25, 320, 2050, 3.1, 0, 12)],
    POSTAVARU_ID:   [(12, 20, 290, 2200, 1.8, 0,  6), (16, 26, 300, 2400, 2.2, 0, 10), (20, 30, 285, 2150, 1.5, 0, 20)],
    LEMPES_ID:      [(8,  13, 330,  900, 0.9, 0,  4), (11, 17, 315, 1050, 1.4, 0,  7), (14, 21, 340, 1200, 1.8, 0, 12)],
    SINAIA_ID:      [(14, 22, 270, 1800, 2.0, 0, 10), (18, 28, 280, 2000, 2.5, 0, 14), (24, 36, 265, 1700, 1.2, 0, 30)],
    CLOPOTIVA_ID:   [(9,  14, 340, 1700, 1.6, 0,  5), (12, 18, 330, 1900, 2.0, 0,  9), (16, 24, 350, 1750, 1.4, 0, 15)],
    RIMETEA_ID:     [(11, 17, 220, 1600, 1.5, 0,  7), (14, 21, 230, 1800, 2.1, 0, 11), (18, 26, 215, 1700, 1.8, 0.1, 18)],
    CREASTA_ID:     [(12, 18, 320, 1900, 1.8, 0,  8), (16, 24, 310, 1750, 2.1, 0, 12), (22, 33, 335, 1500, 1.3, 0, 25)],
    MOGOSA_ID:      [(10, 15, 295, 1800, 1.5, 0,  5), (14, 20, 305, 1700, 1.7, 0,  9), (19, 28, 315, 1500, 1.0, 0, 18)],
    CAVNIC_ID:      [(8,  13, 270, 1600, 1.0, 0,  4), (12, 18, 280, 1550, 1.2, 0.1, 8), (16, 24, 260, 1400, 0.8, 0.2, 16)],
    BORSA_ID:       [(15, 23, 340, 2000, 1.6, 0, 10), (20, 30, 355, 1800, 1.4, 0, 15), (28, 42, 320, 1600, 0.7, 0.8, 50)],
    VAGA_ID:        [(18, 27, 330, 1800, 1.7, 0, 10), (23, 35, 345, 1550, 1.2, 0, 20), (31, 45, 300, 1200, 0.3, 1.0, 55)],
    HAFJELL_ID:     [(12, 19, 205, 1500, 1.0, 0,  5), (16, 23, 220, 1700, 1.4, 0,  8), (21, 29, 240, 1400, 0.8, 0.2, 15)],
    VOSS_ID:        [(26, 39, 270,  900, 0.7, 0.4,35), (34, 48, 285,  780, 0.2, 2.2, 70), (22, 32, 300, 1200, 1.5, 0, 25)],
    GAUSTATOPPEN_ID:[(14, 22, 280, 2200, 2.1, 0,  8), (19, 28, 295, 2000, 1.8, 0, 12), (25, 36, 310, 1700, 1.0, 0, 28)],
    NESAKSLA_ID:    [(20, 30, 340, 1200, 0.8, 0, 15), (27, 40, 355, 1000, 0.4, 0.5, 40), (15, 22, 320, 1400, 1.2, 0, 10)],
    SOGNDAL_ID:     [(10, 16, 185, 1600, 1.3, 0,  6), (14, 21, 195, 1750, 1.5, 0,  9), (18, 26, 210, 1500, 0.9, 0, 18)],
    HEMSEDAL_ID:    [(9,  14,  30, 1900, 1.1, 0,  4), (13, 19,  45, 1800, 0.9, 0,  7), (17, 25,  20, 1600, 0.6, 0, 14)],
    LYNGEN_ID:      [(32, 48, 250,  700, 0.2, 1.2, 65), (22, 34, 265,  900, 0.5, 0.4, 38), (15, 21, 280, 1300, 1.0, 0, 22)],
}


def demo_weather(site_id: UUID) -> list[WeatherHour]:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    profile = _DEMO_PROFILES.get(site_id, _DEMO_PROFILES[VAGA_ID])
    site = SITE_BY_ID.get(site_id)
    alt = site.altitude_m if site else 940
    return [
        WeatherHour(
            valid_time=now + timedelta(hours=idx),
            wind_kmh=wind,
            gust_kmh=gust,
            wind_direction_deg=direction,
            cloudbase_msl_m=cloudbase,
            thermal_strength_ms=thermal,
            rain_mm=rain,
            storm_risk=storm,
            model="demo-best",
            model_run_time=now - timedelta(hours=2),
        )
        for idx, (wind, gust, direction, cloudbase, thermal, rain, storm) in enumerate(profile)
    ]
