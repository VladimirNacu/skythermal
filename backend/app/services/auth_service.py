import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.app.database import db

_crypt = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
_SECRET = os.getenv("JWT_SECRET", "skythermal-dev-secret-change-in-prod")
_ALGO   = "HS256"
_TTL    = timedelta(days=30)


def _token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + _TTL},
        _SECRET, algorithm=_ALGO,
    )


def register(email: str, password: str, display_name: str | None = None) -> dict:
    pw_hash = _crypt.hash(password)
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO auth.users (email, password_hash, display_name)
               VALUES (%s, %s, %s)
               RETURNING id, email, display_name, created_at""",
            (email.lower().strip(), pw_hash, display_name),
        )
        row = cur.fetchone()
    user = {"id": str(row[0]), "email": row[1], "display_name": row[2]}
    _ensure_settings(user["id"])
    return {"user": user, "token": _token(user["id"])}


def login(email: str, password: str) -> dict:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, display_name, password_hash FROM auth.users WHERE email = %s",
            (email.lower().strip(),),
        )
        row = cur.fetchone()
    if row is None or not _crypt.verify(password, row[3]):
        raise ValueError("Invalid email or password")
    user = {"id": str(row[0]), "email": row[1], "display_name": row[2]}
    return {"user": user, "token": _token(user["id"])}


def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGO])
    except JWTError:
        raise ValueError("Invalid or expired token")
    user_id = payload.get("sub")
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, display_name FROM auth.users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise ValueError("User not found")
    return {"id": str(row[0]), "email": row[1], "display_name": row[2]}


def get_favorites(user_id: str) -> list[dict]:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT site_id, site_data FROM catalog.user_favorites WHERE user_id = %s ORDER BY added_at",
            (user_id,),
        )
        return [{"site_id": r[0], "site_data": r[1]} for r in cur.fetchall()]


def add_favorite(user_id: str, site_id: str, site_data: dict) -> None:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO catalog.user_favorites (user_id, site_id, site_data)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id, site_id) DO NOTHING""",
            (user_id, site_id, __import__("json").dumps(site_data)),
        )


def remove_favorite(user_id: str, site_id: str) -> None:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM catalog.user_favorites WHERE user_id = %s AND site_id = %s",
            (user_id, site_id),
        )


def get_settings(user_id: str) -> dict:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT pilot_level, default_overlay, default_altitude_m FROM auth.user_settings WHERE user_id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        return {"pilot_level": "intermediate", "default_overlay": "surface_wind", "default_altitude_m": 0}
    return {"pilot_level": row[0], "default_overlay": row[1], "default_altitude_m": row[2]}


def save_settings(user_id: str, pilot_level: str, default_overlay: str, default_altitude_m: int) -> dict:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO auth.user_settings (user_id, pilot_level, default_overlay, default_altitude_m)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (user_id) DO UPDATE
               SET pilot_level = EXCLUDED.pilot_level,
                   default_overlay = EXCLUDED.default_overlay,
                   default_altitude_m = EXCLUDED.default_altitude_m,
                   updated_at = now()""",
            (user_id, pilot_level, default_overlay, default_altitude_m),
        )
    return {"pilot_level": pilot_level, "default_overlay": default_overlay, "default_altitude_m": default_altitude_m}


def _ensure_settings(user_id: str) -> None:
    with db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO auth.user_settings (user_id) VALUES (%s) ON CONFLICT DO NOTHING""",
            (user_id,),
        )
