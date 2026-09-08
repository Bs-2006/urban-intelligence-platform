from pydantic import BaseModel


class BusStandCreate(BaseModel):
    name: str
    code: str | None = None
    latitude: float
    longitude: float
    address: str | None = None


class BusStandUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    is_active: bool | None = None


class BusStandOut(BaseModel):
    id: int
    name: str
    code: str | None
    latitude: float
    longitude: float
    address: str | None
    is_active: bool

    model_config = {"from_attributes": True}
