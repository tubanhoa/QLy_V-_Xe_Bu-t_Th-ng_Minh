"""
Seed Data: Dữ liệu mẫu cho Smart Bus Ticketing System

Tạo:
  - 8 điểm dừng (trạm xe) tại các tỉnh/thành lớn
  - 5 tuyến xe kết nối các điểm dừng
  - 4 xe buýt với các loại khác nhau
  - Chuyến xe trong 7 ngày tới (để test tìm kiếm)

Cách chạy:
  cd backend
  python -m app.seed
"""

import sys
import os

# Thêm backend vào PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models import Base, Route, Stop, RouteStop, Bus, Seat, Trip, TripStatus
from app.models.bus import BusType
from app.models.seat import SeatType


def seed_stops(db: Session) -> dict[str, Stop]:
    """Tạo các điểm dừng mẫu"""
    stops_data = [
        {
            "name": "Bến xe Mỹ Đình",
            "address": "20 Phạm Hùng, Nam Từ Liêm, Hà Nội",
            "province": "Hà Nội",
            "latitude": 21.0285, "longitude": 105.7826,
        },
        {
            "name": "Bến xe Giáp Bát",
            "address": "Giáp Bát, Hoàng Mai, Hà Nội",
            "province": "Hà Nội",
            "latitude": 20.9832, "longitude": 105.8463,
        },
        {
            "name": "Bến xe Hải Phòng",
            "address": "Lạch Tray, Ngô Quyền, Hải Phòng",
            "province": "Hải Phòng",
            "latitude": 20.8449, "longitude": 106.6881,
        },
        {
            "name": "Bến xe Đà Nẵng",
            "address": "33 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng",
            "province": "Đà Nẵng",
            "latitude": 16.0544, "longitude": 108.2022,
        },
        {
            "name": "Bến xe Miền Đông",
            "address": "292 Đinh Bộ Lĩnh, Bình Thạnh, TP. Hồ Chí Minh",
            "province": "Hồ Chí Minh",
            "latitude": 10.8231, "longitude": 106.6297,
        },
        {
            "name": "Bến xe Miền Tây",
            "address": "395 Kinh Dương Vương, Bình Tân, TP. Hồ Chí Minh",
            "province": "Hồ Chí Minh",
            "latitude": 10.7369, "longitude": 106.6270,
        },
        {
            "name": "Bến xe Vinh",
            "address": "Vinh, Nghệ An",
            "province": "Nghệ An",
            "latitude": 18.6733, "longitude": 105.6922,
        },
        {
            "name": "Bến xe Huế",
            "address": "Phú Bài, Thừa Thiên Huế",
            "province": "Huế",
            "latitude": 16.4637, "longitude": 107.5909,
        },
    ]

    created: dict[str, Stop] = {}
    for data in stops_data:
        # Kiểm tra đã tồn tại chưa
        existing = db.query(Stop).filter(Stop.name == data["name"]).first()
        if existing:
            created[data["name"]] = existing
            continue
        stop = Stop(**data)
        db.add(stop)
        db.flush()
        created[data["name"]] = stop
        print(f"  ✅ Stop: {stop.name}")

    return created


def seed_buses(db: Session) -> list[Bus]:
    """Tạo xe buýt mẫu"""
    buses_data = [
        {
            "license_plate": "29B-12345",
            "bus_type": BusType.LIMOUSINE,
            "total_seats": 34,
            "manufacturer": "Thaco",
            "model": "Puma",
            "year": 2023,
        },
        {
            "license_plate": "51A-67890",
            "bus_type": BusType.SLEEPER,
            "total_seats": 40,
            "manufacturer": "Hyundai",
            "model": "Universe",
            "year": 2022,
        },
        {
            "license_plate": "43C-11111",
            "bus_type": BusType.STANDARD,
            "total_seats": 45,
            "manufacturer": "Thaco",
            "model": "TB120S",
            "year": 2021,
        },
        {
            "license_plate": "15A-22222",
            "bus_type": BusType.LIMOUSINE,
            "total_seats": 34,
            "manufacturer": "Mercedes",
            "model": "Travego",
            "year": 2024,
        },
    ]

    created: list[Bus] = []
    for data in buses_data:
        existing = db.query(Bus).filter(Bus.license_plate == data["license_plate"]).first()
        if existing:
            created.append(existing)
            continue
        bus = Bus(**data)
        db.add(bus)
        db.flush()
        # Tạo ghế cho xe
        _create_seats(db, bus)
        created.append(bus)
        print(f"  ✅ Bus: {bus.license_plate} ({bus.bus_type.value}, {bus.total_seats} ghế)")

    return created


def _create_seats(db: Session, bus: Bus):
    """Tạo ghế cho xe"""
    seat_type = SeatType.SLEEPER if bus.bus_type == BusType.SLEEPER else (
        SeatType.VIP if bus.bus_type == BusType.LIMOUSINE else SeatType.STANDARD
    )
    rows = ["A", "B", "C", "D", "E"]
    cols = range(1, 10)
    count = 0
    for row in rows:
        for col in cols:
            if count >= bus.total_seats:
                break
            seat = Seat(
                bus_id=bus.id,
                seat_number=f"{row}{col}",
                seat_type=seat_type,
                floor=1,
            )
            db.add(seat)
            count += 1
        if count >= bus.total_seats:
            break


def seed_routes(db: Session, stops: dict[str, Stop]) -> list[Route]:
    """Tạo tuyến xe mẫu"""
    routes_data = [
        {
            "route_code": "HN-HP-01",
            "name": "Hà Nội – Hải Phòng (Mỹ Đình – Bến xe HP)",
            "origin": "Bến xe Mỹ Đình",
            "destination": "Bến xe Hải Phòng",
            "distance_km": 120.0,
            "duration_minutes": 120,
            "base_price": 120_000,
            "stops_path": ["Bến xe Mỹ Đình", "Bến xe Hải Phòng"],
        },
        {
            "route_code": "HN-DN-01",
            "name": "Hà Nội – Đà Nẵng (Giáp Bát – Đà Nẵng)",
            "origin": "Bến xe Giáp Bát",
            "destination": "Bến xe Đà Nẵng",
            "distance_km": 764.0,
            "duration_minutes": 780,
            "base_price": 350_000,
            "stops_path": ["Bến xe Giáp Bát", "Bến xe Vinh", "Bến xe Huế", "Bến xe Đà Nẵng"],
        },
        {
            "route_code": "HN-HCM-01",
            "name": "Hà Nội – TP. Hồ Chí Minh (Giáp Bát – Miền Đông)",
            "origin": "Bến xe Giáp Bát",
            "destination": "Bến xe Miền Đông",
            "distance_km": 1710.0,
            "duration_minutes": 1800,
            "base_price": 700_000,
            "stops_path": ["Bến xe Giáp Bát", "Bến xe Vinh", "Bến xe Đà Nẵng", "Bến xe Miền Đông"],
        },
        {
            "route_code": "DN-HCM-01",
            "name": "Đà Nẵng – TP. Hồ Chí Minh (Đà Nẵng – Miền Đông)",
            "origin": "Bến xe Đà Nẵng",
            "destination": "Bến xe Miền Đông",
            "distance_km": 960.0,
            "duration_minutes": 960,
            "base_price": 450_000,
            "stops_path": ["Bến xe Đà Nẵng", "Bến xe Miền Đông"],
        },
        {
            "route_code": "HP-HN-01",
            "name": "Hải Phòng – Hà Nội (Bến xe HP – Mỹ Đình)",
            "origin": "Bến xe Hải Phòng",
            "destination": "Bến xe Mỹ Đình",
            "distance_km": 120.0,
            "duration_minutes": 120,
            "base_price": 120_000,
            "stops_path": ["Bến xe Hải Phòng", "Bến xe Mỹ Đình"],
        },
    ]

    created: list[Route] = []
    for data in routes_data:
        existing = db.query(Route).filter(Route.route_code == data["route_code"]).first()
        if existing:
            created.append(existing)
            continue

        origin_stop = stops[data["origin"]]
        dest_stop = stops[data["destination"]]

        route = Route(
            route_code=data["route_code"],
            name=data["name"],
            origin_stop_id=origin_stop.id,
            destination_stop_id=dest_stop.id,
            distance_km=data["distance_km"],
            duration_minutes=data["duration_minutes"],
            base_price=data["base_price"],
        )
        db.add(route)
        db.flush()

        # Tạo route_stops
        duration_per_stop = data["duration_minutes"] // (len(data["stops_path"]) - 1)
        for i, stop_name in enumerate(data["stops_path"]):
            rs = RouteStop(
                route_id=route.id,
                stop_id=stops[stop_name].id,
                stop_order=i,
                arrival_offset_minutes=i * duration_per_stop,
                is_pickup=(i < len(data["stops_path"]) - 1),
                is_dropoff=(i > 0),
            )
            db.add(rs)

        created.append(route)
        print(f"  ✅ Route: {route.route_code} — {route.name}")

    return created


def seed_trips(db: Session, routes: list[Route], buses: list[Bus]):
    """
    Tạo chuyến xe mẫu trong 7 ngày tới.
    Mỗi tuyến có 3 chuyến/ngày (sáng/trưa/tối).
    """
    today = date.today()
    departure_hours = [6, 12, 20]  # Sáng sớm, Trưa, Tối

    trip_count = 0
    for day_offset in range(7):  # 7 ngày tới
        trip_date = today + timedelta(days=day_offset)

        for i, route in enumerate(routes):
            bus = buses[i % len(buses)]

            for hour in departure_hours:
                departure_dt = datetime.combine(trip_date, datetime.min.time()).replace(hour=hour, minute=0, second=0)
                arrival_dt = departure_dt + timedelta(minutes=route.duration_minutes)

                # Kiểm tra đã tồn tại
                existing = db.query(Trip).filter(
                    Trip.route_id == route.id,
                    Trip.departure_time == departure_dt,
                ).first()
                if existing:
                    continue

                # Giá có thể khác nhau theo giờ (tối đắt hơn)
                price_multiplier = 1.0 if hour != 20 else 1.1
                price = round(route.base_price * price_multiplier, -3)  # Làm tròn nghìn đồng

                available = bus.total_seats - (trip_count % 10)  # Giả lập ghế đã đặt

                trip = Trip(
                    route_id=route.id,
                    bus_id=bus.id,
                    departure_time=departure_dt,
                    arrival_time=arrival_dt,
                    total_seats=bus.total_seats,
                    available_seats=max(0, available),
                    price=price,
                    status=TripStatus.SCHEDULED,
                    driver_name=f"Nguyễn Văn {chr(65 + trip_count % 26)}",
                )
                db.add(trip)
                trip_count += 1

    print(f"  ✅ Trips: {trip_count} chuyến xe (7 ngày tới)")


import pymysql
from app.core.config import settings


def ensure_database_exists():
    """Tự động tạo Database nếu chưa tồn tại"""
    print(f"🔧 Kiểm tra & tạo Database '{settings.DB_NAME}' nếu chưa có...")
    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        conn.commit()
        print(f"  ✅ Database '{settings.DB_NAME}' sẵn sàng!")
    finally:
        conn.close()


def run_seed():
    """Chạy toàn bộ seed data"""
    print("\n🌱 Bắt đầu seed dữ liệu mẫu...\n")

    # 1. Đảm bảo Database tồn tại
    ensure_database_exists()

    # 2. Tạo bảng nếu chưa có
    Base.metadata.create_all(bind=engine)
    print("  ✅ Các bảng CSDL đã được tạo thành công!")

    db = SessionLocal()
    try:
        print("📍 Tạo điểm dừng...")
        stops = seed_stops(db)

        print("\n🚌 Tạo xe buýt...")
        buses = seed_buses(db)

        print("\n🗺️  Tạo tuyến xe...")
        routes = seed_routes(db, stops)

        print("\n📅 Tạo chuyến xe (7 ngày tới)...")
        seed_trips(db, routes, buses)

        db.commit()
        print("\n✅ Seed thành công! Dữ liệu đã được lưu vào DB.\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Lỗi khi seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
