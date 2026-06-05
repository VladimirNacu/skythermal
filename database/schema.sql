CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS weather;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS alerts;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.pilot_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pilot_level TEXT NOT NULL CHECK (pilot_level IN ('beginner', 'intermediate', 'xc', 'competition')),
  wing_class TEXT NOT NULL,
  max_wind_kmh INT NOT NULL,
  max_gust_kmh INT NOT NULL,
  max_accepted_risk INT NOT NULL DEFAULT 70,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog.launch_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  region TEXT NOT NULL,
  launch_point GEOGRAPHY(Point, 4326) NOT NULL,
  altitude_m INT NOT NULL,
  difficulty TEXT NOT NULL,
  safe_directions TEXT[] NOT NULL DEFAULT '{}',
  hazards JSONB NOT NULL DEFAULT '[]',
  local_rules JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS launch_sites_point_gix ON catalog.launch_sites USING GIST (launch_point);
CREATE INDEX IF NOT EXISTS launch_sites_country_status_idx ON catalog.launch_sites (country_code, status);

CREATE TABLE IF NOT EXISTS weather.weather_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_site_id UUID REFERENCES catalog.launch_sites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  position GEOGRAPHY(Point, 4326) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'platform',
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS weather.site_forecast_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_site_id UUID NOT NULL REFERENCES catalog.launch_sites(id) ON DELETE CASCADE,
  valid_time TIMESTAMPTZ NOT NULL,
  model TEXT NOT NULL,
  model_run_time TIMESTAMPTZ NOT NULL,
  wind_kmh NUMERIC NOT NULL,
  gust_kmh NUMERIC NOT NULL,
  wind_direction_deg INT NOT NULL,
  cloudbase_msl_m INT NOT NULL,
  thermal_strength_ms NUMERIC,
  rain_mm NUMERIC NOT NULL DEFAULT 0,
  storm_risk INT NOT NULL DEFAULT 0,
  UNIQUE (launch_site_id, valid_time, model)
);

CREATE TABLE IF NOT EXISTS weather.station_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES weather.weather_stations(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  wind_kmh NUMERIC NOT NULL,
  gust_kmh NUMERIC NOT NULL,
  wind_direction_deg INT NOT NULL,
  temperature_c NUMERIC,
  pressure_hpa NUMERIC,
  battery_v NUMERIC,
  quality_flags JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS station_obs_station_time_idx ON weather.station_observations (station_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS risk.flyability_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_site_id UUID NOT NULL REFERENCES catalog.launch_sites(id) ON DELETE CASCADE,
  valid_time TIMESTAMPTZ NOT NULL,
  pilot_level TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('GO', 'MAYBE', 'NO_GO', 'UNKNOWN')),
  flyability_score INT NOT NULL CHECK (flyability_score BETWEEN 0 AND 100),
  safety_score INT NOT NULL CHECK (safety_score BETWEEN 0 AND 100),
  confidence NUMERIC NOT NULL,
  blockers JSONB NOT NULL DEFAULT '[]',
  explanation JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (launch_site_id, valid_time, pilot_level)
);

CREATE TABLE IF NOT EXISTS ai.briefing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  launch_site_id UUID REFERENCES catalog.launch_sites(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  time_range TSTZRANGE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai.briefing_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES ai.briefing_requests(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  answer TEXT NOT NULL,
  grounded_facts JSONB NOT NULL DEFAULT '[]',
  blockers JSONB NOT NULL DEFAULT '[]',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  launch_site_id UUID REFERENCES catalog.launch_sites(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error TEXT
);

