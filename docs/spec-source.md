# Spec Source Notes

This scaffold was derived from the supplied Paragliding Intelligence Platform PDFs:

- Technical SAD v2
- Volume 01 PRD v2
- Volume 03 Database Design v2
- Volume 04 API Specification v2
- Volume 05 Weather Engine v2
- Volume 06 AI/ML Architecture v2
- Volume 07 Mobile UX Specification v2
- Volume 08 Infrastructure DevOps v2
- Volume 09 Security Architecture v2
- Volume 10 Testing QA v2
- Volume 11 Business Plan v2
- Volume 12 Legal Safety Data Licensing v2
- Volume 13 Launch Site Playbooks Local Expert Ops v2
- Volume 14 Hardware Weather Station Sensor Network v2

## MVP Decisions Captured

- Safety decisions expose a categorical status plus reasons.
- Hard blockers force NO-GO and are never hidden behind an average score.
- AI briefing is an explanation layer over retrieved site, weather, pilot, and flyability data.
- Missing data should produce UNKNOWN rather than invented advice.
- Mobile bootstrap and recommendation contracts are included.
- Database schema follows the documented domains: auth, catalog, weather, risk, ai, alerts, and ops.

## Next Build Steps

1. Replace in-memory seed data with repositories backed by PostGIS.
2. Add Alembic migrations for the schema.
3. Implement weather provider ingestion and interpolation jobs.
4. Add auth, entitlements, and rate limits before exposing paid or user-specific APIs.
5. Scaffold Flutter mobile and Next.js web clients against the generated OpenAPI schema.

