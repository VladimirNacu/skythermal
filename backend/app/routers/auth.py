from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr, Field

from backend.app.services import auth_service

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    display_name: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _current_user(authorization: str = Header(...)):
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        return auth_service.verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/register", status_code=201)
def register(body: RegisterBody):
    try:
        return auth_service.register(body.email, body.password, body.display_name)
    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(body: LoginBody):
    try:
        return auth_service.login(body.email, body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
def me(user=Depends(_current_user)):
    return user
