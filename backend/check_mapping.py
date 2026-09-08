import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.bus import Bus
from app.models.route import Route
from app.models.bus_stand import BusStand

async def main():
    async with AsyncSessionLocal() as s:
        buses = (await s.execute(select(Bus))).scalars().all()
        print(f"DB buses ({len(buses)}):")
        for b in buses:
            print(f"  id={b.id} bus_number={b.bus_number} route_id={b.route_id}")
        routes = (await s.execute(select(Route))).scalars().all()
        print(f"\nDB routes ({len(routes)}):")
        for r in routes:
            print(f"  id={r.id} route_number={r.route_number} name={r.name} {r.start_point}->{r.end_point}")
        stands = (await s.execute(select(BusStand))).scalars().all()
        print(f"\nDB stands ({len(stands)}):")
        for st in stands:
            print(f"  id={st.id} code={st.code} name={st.name} {st.latitude},{st.longitude}")

        # Simulator data hardcoded
        sim_buses = [
            {"bus_id": "BVR-101", "route_id": "BVR001"},
            {"bus_id": "BVR-102", "route_id": "BVR002"},
            {"bus_id": "BVR-103", "route_id": "BVR003"},
        ]
        sim_routes = [
            ("BVR001","Bhimavaram – Palakollu"),("BVR002","Bhimavaram – Tadepalligudem"),("BVR003","Bhimavaram – Narasapur"),
            ("BVR004","Bhimavaram – Tanuku"),("BVR005","Bhimavaram – Undi"),("BVR006","Bhimavaram – Akividu"),
            ("BVR007","Bhimavaram – Attili"),("BVR008","Bhimavaram – Veeravasaram"),
        ]
        gps = ["Bhimavaram","Veeravasaram","Pennada","Palakollu Road","Palakollu","Undi","Attili","Pentapadu","Tadepalligudem","Mogalthur Road","Narsapur Road","Narasapur"]

        print("\n--- MAPPING Simulator Bus -> DB ---")
        db_bus_numbers = {b.bus_number for b in buses}
        for sb in sim_buses:
            match = sb["bus_id"] in db_bus_numbers
            print(f"  {sb['bus_id']} -> DB {'FOUND' if match else 'MISSING'} (DB has {sorted(db_bus_numbers)})")
        print("\n--- MAPPING Simulator Route -> DB ---")
        db_route_numbers = {r.route_number for r in routes}
        for rid,_ in sim_routes:
            match = rid in db_route_numbers
            print(f"  {rid} -> DB {'FOUND' if match else 'MISSING'} (DB has {sorted(db_route_numbers)})")
        print("\n--- MAPPING GPS location -> DB stand ---")
        db_stand_names = {st.name for st in stands}
        db_stand_codes = {st.code for st in stands if st.code}
        for loc in gps:
            found = any(loc.lower() in n.lower() for n in db_stand_names) or loc in db_stand_codes
            print(f"  {loc} -> {'FOUND' if found else 'MISSING'}")

asyncio.run(main())
