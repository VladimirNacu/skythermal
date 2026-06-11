from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.routers import auth, briefings, flyability, mobile, ops, sites, stations, tiles, users, weather
from backend.app.services.ingestion import start_ingestion


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_ingestion(delay_s=5.0)
    yield


app = FastAPI(
    title="SkyThermal API",
    version="0.1.0",
    description="SkyThermal MVP API scaffold generated from the platform specification PDFs.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ops.router)
app.include_router(sites.router)
app.include_router(weather.router)
app.include_router(flyability.router)
app.include_router(briefings.router)
app.include_router(mobile.router)
app.include_router(stations.router)
app.include_router(tiles.router)
app.include_router(users.router)


@app.get("/")
def root():
    return {"name": "SkyThermal", "docs": "/docs"}
