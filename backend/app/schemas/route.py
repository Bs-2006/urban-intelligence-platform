from pydantic import BaseModel


class RouteCreate(BaseModel):
    route_number: str
    name: str
    start_point: str
    end_point: str
    distance_km: float | None = None


class RouteUpdate(BaseModel):
    name: str | None = None
    start_point: str | None = None
    end_point: str | None = None
    distance_km: float | None = None
    is_active: bool | None = None


class RouteOut(BaseModel):
    id: int
    route_number: str
    name: str
    start_point: str
    end_point: str
    distance_km: float | None
    is_active: bool

    model_config = {"from_attributes": True}
