import { useQuery } from "@tanstack/react-query";
import { briefingApi, flyabilityApi, sitesApi, weatherApi } from "./client";
import type { PilotLevel } from "./types";

const FORECAST_TTL = 5 * 60 * 1000; // 5 min — tied to model-run cadence

export function useSites(countryCode?: string) {
  return useQuery({
    queryKey: ["sites", countryCode],
    queryFn: () => sitesApi.list(countryCode),
    staleTime: 60 * 60 * 1000, // catalog is slow-changing
  });
}

export function useFlyabilityTimeline(siteId: string | undefined, pilot: PilotLevel) {
  return useQuery({
    queryKey: ["flyability", siteId, pilot],
    queryFn: () => flyabilityApi.timeline(siteId!, pilot),
    enabled: !!siteId,
    staleTime: FORECAST_TTL,
  });
}

export function useWeatherHourly(siteId: string | undefined) {
  return useQuery({
    queryKey: ["weather", siteId],
    queryFn: () => weatherApi.hourly(siteId!),
    enabled: !!siteId,
    staleTime: FORECAST_TTL,
  });
}

export function useBriefing(siteId: string | undefined, pilot: PilotLevel) {
  return useQuery({
    queryKey: ["briefing", siteId, pilot],
    queryFn: () => briefingApi.site(siteId!, pilot),
    enabled: !!siteId,
    staleTime: FORECAST_TTL,
  });
}
