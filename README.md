# SkyThermal

Spec-based MVP scaffold for SkyThermal, a paragliding decision-support platform. The project turns the supplied PRD, SAD, API, database, weather, AI/ML, mobile UX, security, QA, legal, ops, hardware PDFs, and the supplied frontend ZIP into an executable starter.

The first slice includes:

- Launch site catalog and nearby lookup
- Hourly weather and flyability timelines
- GO / MAYBE / NO-GO decisions with top reasons and hard blockers
- Mobile recommendation endpoint
- Grounded AI briefing stub that never overrides deterministic blockers
- Weather station uplink endpoint
- PostgreSQL/PostGIS-oriented schema draft
- React/Vite frontend dashboard from `skythermal_frontend_layout.zip`
- FastAPI tests for the decision layer and public endpoints

## Stack

- React + Vite frontend
- Python 3.11+
- FastAPI + Pydantic
- Pytest
- PostgreSQL/PostGIS schema draft under `database/`
- Docker Compose with API, PostGIS, and Redis

## Run Locally

Backend:

```bash
cd skythermal
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn backend.app.main:app --reload --port 8080
```

Frontend:

```bash
cd skythermal/frontend
npm install
npm run dev
```

Open:

- Frontend: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8080/docs
- Health: http://127.0.0.1:8080/v1/ops/health

## Run Tests

```bash
cd skythermal
pytest
```

## Docker

```bash
cd skythermal
docker compose up --build
```

The API starts on http://127.0.0.1:8080 and the frontend starts on http://127.0.0.1:5173.

## Specification Mapping

The PDFs describe a larger platform with Flutter mobile, Next.js web, MapLibre maps, PostGIS/Timescale storage, weather ingestion, AI briefings, subscriptions, clubs, schools, events, live tracking, alerting, and hardware station operations.

This scaffold implements the backend MVP surface and the supplied frontend layout. The frontend currently uses mock dashboard data; the next integration step is to replace those mocks with calls to `/v1/sites/recommendations`, `/v1/flyability/sites/{site_id}/timeline`, and `/v1/briefings/site`.
