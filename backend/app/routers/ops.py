from fastapi import APIRouter

from backend.app.config import settings

router = APIRouter(prefix="/v1/ops", tags=["ops"])


@router.get("/health")
def health():
    return {"status": "ok", "env": settings.app_env}

