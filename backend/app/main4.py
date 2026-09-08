postgresql://postgres:[123]@db.latomcgkjajekewfzpwm.supabase.co:5432/postgres
from sqlmodel import SQLModel, Field
from typing import Optional

class Item(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    price: float
    is_offer: bool = False


from sqlmodel import create_engine, Session

engine = create_engine(postgres_uri, echo=True)

from fastapi import FastAPI
from contextlib import asynccontextmanager

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

@asynccontextmanager
def lifespan(app: FastAPI):
    create_db_and_tables()
    yield
    SQLModel.metadata.drop_all(engine)

app = FastAPI(lifespan=lifespan)

@app.post("/items/")
def create_item(item: Item):
    with Session(engine) as session:
        session.add(item)
        session.commit()
        session.refresh(item)
        return item