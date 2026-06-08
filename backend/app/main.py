from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import briefings, flyability, mobile, ops, sites, stations, tiles, weather

app = FastAPI(
    title="SkyThermal API",
    version="0.1.0",
    description="SkyThermal MVP API scaffold generated from the platform specification PDFs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ops.router)
app.include_router(sites.router)
app.include_router(weather.router)
app.include_router(flyability.router)
app.include_router(briefings.router)
app.include_router(mobile.router)
app.include_router(stations.router)
app.include_router(tiles.router)


@app.get("/")
def root():
    return {"name": "SkyThermal", "docs": "/docs"}
