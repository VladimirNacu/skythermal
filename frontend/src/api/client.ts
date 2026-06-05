import type {
  BriefingResponse,
  FlyabilityHour,
  LaunchSite,
  MobileBootstrap,
  PilotLevel,
  SiteRecommendation,
  WeatherHour,
} from "./types";

// Same-origin by default (nginx proxies /v1). Override with VITE_API_URL in dev.
const BASE = import.meta.env.VITE_API_URL ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return res.json() as Promise<T>;
}

export const sitesApi = {
  list: (countryCode?: string) =>
    get<LaunchSite[]>(`/v1/sites${countryCode ? `?country_code=${countryCode}` : ""}`),

  detail: (siteId: string) => get<LaunchSite>(`/v1/sites/${siteId}`),

  recommendations: (
    lat: number,
    lon: number,
    radiusKm = 180,
    pilotLevel: PilotLevel = "intermediate",
  ) =>
    get<SiteRecommendation[]>(
      `/v1/sites/recommendations?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&pilot_level=${pilotLevel}`,
    ),
};

export const weatherApi = {
  hourly: (siteId: string) => get<WeatherHour[]>(`/v1/weather/sites/${siteId}/hourly`),
};

export const flyabilityApi = {
  timeline: (siteId: string, pilotLevel: PilotLevel = "intermediate") =>
    get<FlyabilityHour[]>(
      `/v1/flyability/sites/${siteId}/timeline?pilot_level=${pilotLevel}`,
    ),
};

export const briefingApi = {
  site: (siteId: string, pilotLevel: PilotLevel = "intermediate") => {
    const now = new Date();
    const end = new Date(now.getTime() + 12 * 3600 * 1000);
    return post<BriefingResponse>(`/v1/briefings/site`, {
      question: "Is it safe to fly today?",
      site_id: siteId,
      pilot_profile: { pilot_level: pilotLevel },
      start: now.toISOString(),
      end: end.toISOString(),
      include_sources: true,
    });
  },
};

export const mobileApi = {
  bootstrap: () => get<MobileBootstrap>(`/v1/mobile/bootstrap`),
};
