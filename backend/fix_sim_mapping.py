import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.models.route import Route
from app.models.bus import Bus
from app.models.bus_stand import BusStand

# Simulator GPS coords for missing stands
GPS_COORDS = {
    "Pennada": (16.5560, 81.6150),
    "Palakollu Road": (16.5200, 81.6800),
    "Undi": (16.6023, 81.5761),
    "Attili": (16.6000, 81.6000),
    "Mogalthur Road": (16.4800, 81.6000),
    "Narsapur Road": (16.4500, 81.6500),
}

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as s:
        # Routes: add BVR001..BVR008 if missing, keep existing BVR-101 etc
        sim_routes = [
            ("BVR001","Bhimavaram – Palakollu","Bhimavaram RTC Complex","Palakollu",18.5),
            ("BVR002","Bhimavaram – Tadepalligudem","Bhimavaram RTC Complex","Tadepalligudem",32.0),
            ("BVR003","Bhimavaram – Narasapur","Bhimavaram RTC Complex","Narasapur",28.0),
            ("BVR004","Bhimavaram – Tanuku","Bhimavaram RTC Complex","Tanuku",22.0),
            ("BVR005","Bhimavaram – Undi","Bhimavaram RTC Complex","Undi",15.0),
            ("BVR006","Bhimavaram – Akividu","Bhimavaram RTC Complex","Akividu",15.0),
            ("BVR007","Bhimavaram – Attili","Bhimavaram RTC Complex","Attili",15.0),
            ("BVR008","Bhimavaram – Veeravasaram","Bhimavaram RTC Complex","Veeravasaram",12.0),
        ]
        added_routes=0
        for num,name,sp,ep,d in sim_routes:
            r=await s.execute(select(Route).where(Route.route_number==num))
            if not r.scalar_one_or_none():
                s.add(Route(route_number=num,name=name,start_point=sp,end_point=ep,distance_km=d))
                added_routes+=1
        await s.commit()
        print(f"Added routes: {added_routes}")

        # Buses: add BVR-101..103 exactly matching SIM_BUSES
        sim_buses = [
            ("BVR-101","BVR001"),("BVR-102","BVR002"),("BVR-103","BVR003"),
        ]
        # map route_number -> id
        all_routes = (await s.execute(select(Route))).scalars().all()
        route_map={r.route_number:r.id for r in all_routes}
        added_buses=0
        for bus_num, route_num in sim_buses:
            r=await s.execute(select(Bus).where(Bus.bus_number==bus_num))
            if not r.scalar_one_or_none():
                rid=route_map.get(route_num)
                s.add(Bus(bus_number=bus_num, capacity=50, route_id=rid))
                added_buses+=1
        await s.commit()
        print(f"Added buses: {added_buses}")

        # Stands for missing GPS
        missing_stands = [
            ("Pennada Stand","PEN", "Pennada"),
            ("Palakollu Road Stand","PLKRD", "Palakollu Road"),
            ("Undi Stand","UNDI", "Undi"),
            ("Attili Stand","ATTI", "Attili"),
            ("Mogalthur Road Stand","MOG", "Mogalthur Road"),
            ("Narsapur Road Stand","NSRRD", "Narsapur Road"),
        ]
        added_stands=0
        for name,code,loc in missing_stands:
            r=await s.execute(select(BusStand).where(BusStand.code==code))
            if not r.scalar_one_or_none():
                lat,lng=GPS_COORDS[loc]
                s.add(BusStand(name=name,code=code,latitude=lat,longitude=lng,address=f"{loc}, Bhimavaram"))
                added_stands+=1
        await s.commit()
        print(f"Added stands: {added_stands}")

        # Summary
        from sqlalchemy import func
        for tbl,name in [(Bus,"Buses"),(Route,"Routes"),(BusStand,"Stands")]:
            r=await s.execute(select(func.count()).select_from(tbl))
            print(f"{name} total: {r.scalar()}")

asyncio.run(main())
