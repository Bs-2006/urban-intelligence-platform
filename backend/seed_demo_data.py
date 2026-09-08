"""Idempotent demo seeder for Urban Intelligence Platform.

Uses existing models + DATABASE_URL from .env via app.config.
No Supabase required; image_key left NULL so image_url stays None (frontend handles missing image).
Coordinates are realistic Bhimavaram / West Godavari urban area (16.4-16.85, 81.47-81.74).
"""
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.database import AsyncSessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.route import Route
from app.models.bus import Bus
from app.models.bus_stand import BusStand
from app.models.incident import Incident, IncidentType, IncidentSeverity, IncidentStatus, IncidentSource
from app.models.work import WorkOrder, WorkStatus
from app.models.bus_observation import BusObservation
from app.utils.security import hash_password

# Ensure all models imported before create_all (bus_observation etc.)
import app.models.bus_observation  # noqa
import app.models.bus_stand  # noqa

# --- demo constants ---
Bhimavaram_COORDS = [
    ("Bhimavaram RTC Complex", 16.5449, 81.5212),
    ("Veeravasaram Junction", 16.5438, 81.4733),
    ("Palakollu Road", 16.5200, 81.6800),
    ("Palakollu Town", 16.5169, 81.7304),
    ("Undi Village", 16.6023, 81.5761),
    ("Tadepalligudem Highway", 16.8341, 81.5235),
    ("Akividu Crossroads", 16.5800, 81.3800),
    ("Tanuku Main Road", 16.7550, 81.6800),
    ("Narasapur Port Road", 16.4363, 81.6723),
    ("Attili Bypass", 16.6000, 81.6000),
    ("Pentapadu Market", 16.7700, 81.5500),
    ("Mogalthur Road", 16.4800, 81.6000),
]

SEED_USERS = [
    dict(email="admin@urban.local", full_name="City Administrator", role=UserRole.admin, phone="9000000001", password="Admin@123"),
    dict(email="manager@urban.local", full_name="Transport Officer Rao", role=UserRole.transport_officer, phone="9000000002", password="Manager@123"),
    dict(email="worker1@urban.local", full_name="Ravi Kumar (Field Crew)", role=UserRole.worker, phone="9000000003", password="Worker@123"),
    dict(email="worker2@urban.local", full_name="Sita Devi (Field Crew)", role=UserRole.worker, phone="9000000004", password="Worker@123"),
    dict(email="citizen@urban.local", full_name="Demo Citizen", role=UserRole.citizen, phone="9000000005", password="Citizen@123"),
]

SEED_ROUTES = [
    dict(route_number="BVR-101", name="Bhimavaram – Palakollu", start_point="Bhimavaram RTC Complex", end_point="Palakollu", distance_km=18.5),
    dict(route_number="BVR-102", name="Bhimavaram – Tadepalligudem", start_point="Bhimavaram RTC Complex", end_point="Tadepalligudem", distance_km=32.0),
    dict(route_number="BVR-103", name="Bhimavaram – Narasapur", start_point="Bhimavaram RTC Complex", end_point="Narasapur", distance_km=28.0),
    dict(route_number="BVR-104", name="Bhimavaram – Tanuku", start_point="Bhimavaram RTC Complex", end_point="Tanuku", distance_km=22.0),
    dict(route_number="BVR-105", name="Bhimavaram – Akividu", start_point="Bhimavaram RTC Complex", end_point="Akividu", distance_km=15.0),
]

SEED_STANDS = [
    dict(code="RTC-BVM", name="Bhimavaram RTC Complex", latitude=16.5449, longitude=81.5212, address="RTC Complex, Bhimavaram"),
    dict(code="VEER", name="Veeravasaram Stand", latitude=16.5438, longitude=81.4733, address="Veeravasaram Junction"),
    dict(code="PPADU", name="Pentapadu Stand", latitude=16.7700, longitude=81.5500, address="Pentapadu Market"),
    dict(code="TADP", name="Tadepalligudem Stand", latitude=16.8341, longitude=81.5235, address="Tadepalligudem Bus Stand"),
    dict(code="NARS", name="Narasapur Stand", latitude=16.4363, longitude=81.6723, address="Narasapur Port Road"),
    dict(code="TANU", name="Tanuku Stand", latitude=16.7550, longitude=81.6800, address="Tanuku Main Road"),
    dict(code="PALAK", name="Palakollu Stand", latitude=16.5169, longitude=81.7304, address="Palakollu Town"),
]

SEED_BUSES = [
    dict(bus_number="AP37-BVR101", capacity=52),
    dict(bus_number="AP37-BVR102", capacity=48),
    dict(bus_number="AP37-BVR103", capacity=50),
    dict(bus_number="AP37-BVR104", capacity=45),
    dict(bus_number="AP37-BVR105", capacity=50),
]

# 20 incidents covering required types, mixed severities/statuses/sources
INCIDENTS_RAW = [
    dict(incident_type=IncidentType.pothole, severity=IncidentSeverity.critical, status=IncidentStatus.reported, title="Large pothole on Palakollu Road", description="Deep pothole (~40cm) causing tyre damage near Palakollu Road culvert.", coord_idx=2, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.waterlogging, severity=IncidentSeverity.high, status=IncidentStatus.pending, title="Waterlogging after overnight rain – RTC Complex", description="Stagnant water 15cm deep at Bhimavaram RTC entry blocks buses.", coord_idx=0, source=IncidentSource.ai, ai_conf=0.91),
    dict(incident_type=IncidentType.damaged_road, severity=IncidentSeverity.high, status=IncidentStatus.in_progress, title="Cracked carriageway, Veeravasaram Junction", description="Longitudinal cracks 20m stretch; patchwork needed.", coord_idx=1, source=IncidentSource.ai, ai_conf=0.87),
    dict(incident_type=IncidentType.missing_divider, severity=IncidentSeverity.medium, status=IncidentStatus.reported, title="Missing median divider, Undi stretch", description="Concrete divider stolen/missing 12m.", coord_idx=4, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.missing_zebra, severity=IncidentSeverity.medium, status=IncidentStatus.pending, title="Faded zebra crossing, Tadepalligudem Highway", description="School zone zebra completely worn out.", coord_idx=5, source=IncidentSource.ai, ai_conf=0.88),
    dict(incident_type=IncidentType.damaged_sign, severity=IncidentSeverity.low, status=IncidentStatus.reported, title="Bent speed-limit sign, Attili Bypass", description="Sign post tilted after minor accident.", coord_idx=9, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.traffic_congestion, severity=IncidentSeverity.high, status=IncidentStatus.reported, title="Peak-hour congestion, Tanuku Main Road", description="Vehicle queue >400m during evening peak.", coord_idx=7, source=IncidentSource.ai, ai_conf=0.94, vehicle_count=82, congestion_level="severe"),
    dict(incident_type=IncidentType.pothole, severity=IncidentSeverity.medium, status=IncidentStatus.resolved, title="Pothole cluster, Mogalthur Road", description="3 small potholes patched – pending verification.", coord_idx=11, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.garbage, severity=IncidentSeverity.medium, status=IncidentStatus.pending, title="Garbage dump overflow, Pentapadu Market", description="Market waste spilling onto carriageway.", coord_idx=10, source=IncidentSource.ai, ai_conf=0.93),
    dict(incident_type=IncidentType.streetlight, severity=IncidentSeverity.low, status=IncidentStatus.reported, title="Streetlight outage, Akividu Crossroads", description="2 consecutive poles dark – safety risk at night.", coord_idx=6, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.pedestrian_crossing, severity=IncidentSeverity.medium, status=IncidentStatus.in_progress, title="Pedestrian crowding, Bhimavaram High School", description="Students crossing without designated zone.", coord_idx=0, source=IncidentSource.ai, ai_conf=0.81),
    dict(incident_type=IncidentType.damaged_road, severity=IncidentSeverity.critical, status=IncidentStatus.pending, title="Severe rutting, Narasapur Port Road", description="Heavy vehicle rutting 5km stretch.", coord_idx=8, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.garbage, severity=IncidentSeverity.high, status=IncidentStatus.reported, title="Illegal dumping, Palakollu Town", description="Construction debris dumped near bus stand.", coord_idx=3, source=IncidentSource.ai, ai_conf=0.89),
    dict(incident_type=IncidentType.waterlogging, severity=IncidentSeverity.critical, status=IncidentStatus.in_progress, title="Flooded underpass, Veeravasaram", description="Underpass submerged, diversions in place.", coord_idx=1, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.traffic_congestion, severity=IncidentSeverity.medium, status=IncidentStatus.resolved, title="Cleared congestion, Pentapadu", description="Earlier jam cleared after enforcement.", coord_idx=10, source=IncidentSource.ai, ai_conf=0.86, vehicle_count=38, congestion_level="moderate"),
    dict(incident_type=IncidentType.missing_zebra, severity=IncidentSeverity.high, status=IncidentStatus.pending, title="Missing zebra, Undi Village approach", description="No marking on newly laid road.", coord_idx=4, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.damaged_sign, severity=IncidentSeverity.medium, status=IncidentStatus.reported, title="Missing ‘School Ahead’ board", description="Sign missing since road widening.", coord_idx=9, source=IncidentSource.ai, ai_conf=0.84),
    dict(incident_type=IncidentType.pothole, severity=IncidentSeverity.low, status=IncidentStatus.closed, title="Small pothole, Tadepalligudem Highway", description="Closed after inspection – within tolerance.", coord_idx=5, source=IncidentSource.ai, ai_conf=0.79),
    dict(incident_type=IncidentType.streetlight, severity=IncidentSeverity.critical, status=IncidentStatus.pending, title="Flickering lights, Bhimavaram RTC exit", description="Intermittent flicker affecting CCTV.", coord_idx=0, source=IncidentSource.citizen, ai_conf=None),
    dict(incident_type=IncidentType.garbage, severity=IncidentSeverity.low, status=IncidentStatus.resolved, title="Cleared garbage, Mogalthur Road", description="Sanitation crew cleared site.", coord_idx=11, source=IncidentSource.ai, ai_conf=0.90),
    dict(incident_type=IncidentType.pothole, severity=IncidentSeverity.high, status=IncidentStatus.pending, title="Bus lane pothole, Tanuku Main Road", description="Pothole in dedicated bus lane.", coord_idx=7, source=IncidentSource.ai, ai_conf=0.92),
    dict(incident_type=IncidentType.other, severity=IncidentSeverity.medium, status=IncidentStatus.reported, title="Illegal parking, Bhimavaram RTC Complex", description="Autos blocking bus bay.", coord_idx=0, source=IncidentSource.citizen, ai_conf=None),
]

async def get_or_create_user(session, data):
    r = await session.execute(select(User).where(User.email == data["email"]))
    u = r.scalar_one_or_none()
    if u:
        return u, False
    u = User(
        full_name=data["full_name"],
        email=data["email"],
        phone=data["phone"],
        hashed_password=hash_password(data["password"]),
        role=data["role"],
        is_active=True,
        is_verified=True,
    )
    session.add(u)
    await session.flush()
    return u, True

async def main():
    # create tables first
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Users
        users_created = 0
        user_by_email = {}
        for ud in SEED_USERS:
            u, created = await get_or_create_user(session, ud)
            user_by_email[ud["email"]] = u
            if created:
                users_created += 1
        await session.commit()
        # re-fetch to get IDs
        r = await session.execute(select(User))
        all_users = {u.email: u for u in r.scalars().all()}

        # Routes
        routes_created = 0
        for rd in SEED_ROUTES:
            r = await session.execute(select(Route).where(Route.route_number == rd["route_number"]))
            if r.scalar_one_or_none():
                continue
            session.add(Route(**rd))
            routes_created += 1
        await session.commit()
        r = await session.execute(select(Route))
        routes = list(r.scalars().all())
        route_by_number = {rt.route_number: rt for rt in routes}

        # Bus stands
        stands_created = 0
        for sd in SEED_STANDS:
            r = await session.execute(select(BusStand).where(BusStand.code == sd["code"]))
            if r.scalar_one_or_none():
                continue
            session.add(BusStand(**sd))
            stands_created += 1
        await session.commit()

        # Buses
        buses_created = 0
        for i, bd in enumerate(SEED_BUSES):
            r = await session.execute(select(Bus).where(Bus.bus_number == bd["bus_number"]))
            if r.scalar_one_or_none():
                continue
            route = routes[i % len(routes)] if routes else None
            session.add(Bus(bus_number=bd["bus_number"], capacity=bd["capacity"], route_id=route.id if route else None))
            buses_created += 1
        await session.commit()
        r = await session.execute(select(Bus))
        buses = list(r.scalars().all())

        # Incidents – idempotent by title
        incidents_created = 0
        now = datetime.now(timezone.utc)
        for idx, raw in enumerate(INCIDENTS_RAW):
            r = await session.execute(select(Incident).where(Incident.title == raw["title"]))
            if r.scalar_one_or_none():
                continue
            loc_name, lat, lng = Bhimavaram_COORDS[raw["coord_idx"]]
            # realistic occurred_at spread over last 14 days
            occurred = now - timedelta(days=idx % 14, hours=(idx * 3) % 24)
            # bus/route linkage: ai incidents get bus, citizen may not
            bus_id_fk = None
            route_id_fk = None
            if raw["source"] == IncidentSource.ai and buses:
                bus = buses[idx % len(buses)]
                bus_id_fk = bus.id
                route_id_fk = bus.route_id
            elif idx % 3 == 0 and buses:
                bus = buses[idx % len(buses)]
                bus_id_fk = bus.id
                route_id_fk = bus.route_id

            # reported_by / created_by for citizen
            reported_by = None
            created_by = None
            if raw["source"] == IncidentSource.citizen:
                citizen = all_users.get("citizen@urban.local")
                if citizen:
                    reported_by = citizen.id
                    created_by = citizen.id

            inc = Incident(
                incident_type=raw["incident_type"],
                severity=raw["severity"],
                status=raw["status"],
                title=raw["title"],
                description=raw["description"],
                latitude=lat + (idx * 0.0001),  # slight jitter to avoid exact overlap
                longitude=lng + (idx * 0.0001),
                location_name=loc_name,
                address=f"{loc_name}, Bhimavaram, Andhra Pradesh",
                source=raw["source"],
                reported_by=reported_by,
                created_by=created_by,
                bus_id=bus_id_fk,
                route_id=route_id_fk,
                occurred_at=occurred,
                ai_confidence=raw.get("ai_conf"),
                vehicle_count=raw.get("vehicle_count"),
                congestion_level=raw.get("congestion_level"),
                metadata_json={"seed": True, "demo": True},
                image_key=None,
            )
            session.add(inc)
            incidents_created += 1
        await session.commit()
        r = await session.execute(select(Incident))
        incidents = list(r.scalars().all())

        # Work orders – one per first 8 incidents, varied statuses
        statuses = [WorkStatus.assigned, WorkStatus.in_progress, WorkStatus.completed, WorkStatus.cancelled]
        worker1 = all_users.get("worker1@urban.local")
        worker2 = all_users.get("worker2@urban.local")
        manager = all_users.get("manager@urban.local") or all_users.get("admin@urban.local")
        workers = [w for w in [worker1, worker2] if w]
        work_created = 0
        for i, inc in enumerate(incidents[:8]):
            # idempotent by (incident_id, title)
            title = f"Work: {inc.title[:50]}"
            r = await session.execute(select(WorkOrder).where(WorkOrder.incident_id == inc.id))
            if r.scalars().first():
                continue
            assigned = workers[i % len(workers)] if workers else None
            status = statuses[i % len(statuses)]
            wo = WorkOrder(
                incident_id=inc.id,
                assigned_to=assigned.id if assigned else None,
                created_by=manager.id if manager else all_users["admin@urban.local"].id,
                title=title,
                description=f"Attend to: {(inc.description or inc.title)[:120]}",
                status=status,
                due_date=now + timedelta(days=3 + i),
            )
            session.add(wo)
            work_created += 1
        await session.commit()

        # Bus observations – 6 recent raw camera feeds
        obs_created = 0
        for i in range(6):
            name, lat, lng = Bhimavaram_COORDS[i]
            # idempotent by (bus_id, location_name, lat)
            # simple: check if same bus_id+location exists recently
            bus_label = buses[i % len(buses)].bus_number if buses else f"BVR-10{i}"
            r = await session.execute(select(BusObservation).where(BusObservation.bus_id == bus_label).where(BusObservation.location_name == name))
            if r.scalars().first():
                continue
            obs = BusObservation(
                bus_id=bus_label,
                route_id=routes[i % len(routes)].route_number if routes else None,
                latitude=lat,
                longitude=lng,
                location_name=name,
                occurred_at=now - timedelta(hours=i * 2),
                image_path=None, image_key=None, image_url=None,
            )
            session.add(obs)
            obs_created += 1
        await session.commit()

        # Summary
        from sqlalchemy import func as sa_func
        for tbl, name in [(User, "Users"), (Route, "Routes"), (Bus, "Buses"), (BusStand, "Bus stands"), (Incident, "Incidents"), (WorkOrder, "Work orders"), (BusObservation, "Bus observations")]:
            r = await session.execute(select(sa_func.count()).select_from(tbl))
            total = r.scalar()
            print(f"{name}: {total}")

        print(f"\nInserted this run – Users:{users_created} Routes:{routes_created} Buses:{buses_created} Stands:{stands_created} Incidents:{incidents_created} Work:{work_created} Obs:{obs_created}")

if __name__ == "__main__":
    asyncio.run(main())
