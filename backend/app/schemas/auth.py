import uuid

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)
    role: str = Field(default="operator", pattern="^(admin|operator)$")


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    role: str

    model_config = {"from_attributes": True}


class MeOut(UserOut):
    csrf_token: str
