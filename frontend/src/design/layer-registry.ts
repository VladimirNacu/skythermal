// Weather layer registry — guide section 6.
// The front-end contract telling the UI how to render each weather layer.

export type LayerGroup = "Launch Safety" | "XC Potential" | "Danger" | "Navigation";
export type Entitlement = "free" | "pro" | "pro_plus";
export type VariableType = "vector" | "scalar" | "derived_scalar" | "raster" | "point";
export type Renderer =
  | "colorRaster"
  | "particles"
  | "isolines"
  | "riskPolygons"
  | "transparentRaster"
  | "points"
  | "arrows";

export interface LayerLegend {
  min: number;
  max: number;
  ticks: number[];
  unit: string;
}

export interface LayerDefinition {
  id: OverlayId;
  label: string;
  group: LayerGroup;
  variableType: VariableType;
  units: string;
  altitudeSelector?: boolean;
  renderer: Renderer[];
  entitlement: Entitlement;
  defaultOpacity: number;
  colorScale?: string;
  legend?: LayerLegend;
}

export type OverlayId =
  | "surface_wind"
  | "altitude_wind"
  | "gusts"
  | "thermals"
  | "cloudbase"
  | "cape_instability"
  | "rain_radar"
  | "lightning"
  | "visibility"
  | "temperature_dewpoint"
  | "pressure_trend"
  | "wave_rotor_risk"
  | "foehn_indicator";

const windLegend: LayerLegend = {
  min: 0,
  max: 80,
  ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80],
  unit: "km/h",
};

export const LAYER_REGISTRY: Record<OverlayId, LayerDefinition> = {
  surface_wind: {
    id: "surface_wind",
    label: "Surface Wind",
    group: "Launch Safety",
    variableType: "vector",
    units: "km/h",
    renderer: ["colorRaster", "particles"],
    entitlement: "free",
    defaultOpacity: 0.78,
    colorScale: "windSpeedKmh",
    legend: windLegend,
  },
  altitude_wind: {
    id: "altitude_wind",
    label: "Wind at Altitude",
    group: "Launch Safety",
    variableType: "vector",
    units: "km/h",
    altitudeSelector: true,
    renderer: ["colorRaster", "particles"],
    entitlement: "free",
    defaultOpacity: 0.78,
    colorScale: "windSpeedKmh",
    legend: windLegend,
  },
  gusts: {
    id: "gusts",
    label: "Gusts",
    group: "Launch Safety",
    variableType: "scalar",
    units: "km/h",
    renderer: ["colorRaster"],
    entitlement: "free",
    defaultOpacity: 0.72,
    colorScale: "windSpeedKmh",
    legend: windLegend,
  },
  thermals: {
    id: "thermals",
    label: "Thermals",
    group: "XC Potential",
    variableType: "scalar",
    units: "m/s",
    renderer: ["colorRaster"],
    entitlement: "pro",
    defaultOpacity: 0.7,
    legend: { min: 0, max: 5, ticks: [0, 1, 2, 3, 4, 5], unit: "m/s" },
  },
  cloudbase: {
    id: "cloudbase",
    label: "Cloudbase",
    group: "XC Potential",
    variableType: "scalar",
    units: "m",
    renderer: ["colorRaster", "isolines"],
    entitlement: "pro",
    defaultOpacity: 0.68,
    legend: { min: 0, max: 4000, ticks: [0, 1000, 2000, 3000, 4000], unit: "m" },
  },
  cape_instability: {
    id: "cape_instability",
    label: "CAPE / Instability",
    group: "Danger",
    variableType: "scalar",
    units: "J/kg",
    renderer: ["colorRaster"],
    entitlement: "pro",
    defaultOpacity: 0.6,
  },
  rain_radar: {
    id: "rain_radar",
    label: "Rain Radar",
    group: "Danger",
    variableType: "raster",
    units: "mm/h",
    renderer: ["transparentRaster"],
    entitlement: "free",
    defaultOpacity: 0.65,
  },
  lightning: {
    id: "lightning",
    label: "Lightning",
    group: "Danger",
    variableType: "point",
    units: "strikes",
    renderer: ["points"],
    entitlement: "free",
    defaultOpacity: 0.9,
  },
  visibility: {
    id: "visibility",
    label: "Visibility",
    group: "Navigation",
    variableType: "scalar",
    units: "km",
    renderer: ["colorRaster"],
    entitlement: "pro",
    defaultOpacity: 0.6,
  },
  temperature_dewpoint: {
    id: "temperature_dewpoint",
    label: "Temperature / Dewpoint",
    group: "Navigation",
    variableType: "scalar",
    units: "°C",
    renderer: ["colorRaster"],
    entitlement: "free",
    defaultOpacity: 0.6,
  },
  pressure_trend: {
    id: "pressure_trend",
    label: "Pressure Trend",
    group: "Navigation",
    variableType: "scalar",
    units: "hPa",
    renderer: ["isolines", "arrows"],
    entitlement: "pro",
    defaultOpacity: 0.55,
  },
  wave_rotor_risk: {
    id: "wave_rotor_risk",
    label: "Wave / Rotor Risk",
    group: "Danger",
    variableType: "derived_scalar",
    units: "risk",
    renderer: ["riskPolygons", "transparentRaster"],
    entitlement: "pro_plus",
    defaultOpacity: 0.55,
  },
  foehn_indicator: {
    id: "foehn_indicator",
    label: "Föhn Indicator",
    group: "Danger",
    variableType: "derived_scalar",
    units: "risk",
    renderer: ["riskPolygons"],
    entitlement: "pro_plus",
    defaultOpacity: 0.55,
  },
};

export const LAYER_GROUPS: LayerGroup[] = [
  "Launch Safety",
  "XC Potential",
  "Danger",
  "Navigation",
];

export function layersByGroup(group: LayerGroup): LayerDefinition[] {
  return Object.values(LAYER_REGISTRY).filter((l) => l.group === group);
}
