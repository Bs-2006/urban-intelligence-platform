from pydantic import BaseModel


class BusCreate(BaseModel):
    bus_number: str
    route_id: int | None = None
    capacity: int = 50
    driver_id: int | None = None


class BusUpdate(BaseModel):
    route_id: int | None = None
    capacity: int | None = None
    driver_id: int | None = None
    is_active: bool | None = None


class BusOut(BaseModel):
    id: int
    bus_number: str
    route_id: int | None
    capacity: int
    is_active: bool
    driver_id: int | None

    model_config = {"from_attributes": True}
