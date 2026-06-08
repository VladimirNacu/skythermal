from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from backend.app.routers.auth import _current_user
from backend.app.services import auth_service

router = APIRouter(prefix="/v1/users", tags=["users"])


class FavoriteBody(BaseModel):
    site_id: str
    site_data: dict


class SettingsBody(BaseModel):
    pilot_level: str = "intermediate"
    default_overlay: str = "surface_wind"
    default_altitude_m: int = 0


@router.get("/me/favorites")
def list_favorites(user=Depends(_current_user)):
    return auth_service.get_favorites(user["id"])


@router.post("/me/favorites", status_code=201)
def add_favorite(body: FavoriteBody, user=Depends(_current_user)):
    auth_service.add_favorite(user["id"], body.site_id, body.site_data)
    return {"ok": True}


@router.delete("/me/favorites/{site_id}")
def remove_favorite(site_id: str, user=Depends(_current_user)):
    auth_service.remove_favorite(user["id"], site_id)
    return {"ok": True}


@router.get("/me/settings")
def get_settings(user=Depends(_current_user)):
    return auth_service.get_settings(user["id"])


@router.put("/me/settings")
def save_settings(body: SettingsBody, user=Depends(_current_user)):
    return auth_service.save_settings(
        user["id"], body.pilot_level, body.default_overlay, body.default_altitude_m
    )
