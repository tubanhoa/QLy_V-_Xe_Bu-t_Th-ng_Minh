"""
Service: Tìm kiếm Tuyến/Chuyến xe

Chứa toàn bộ business logic:
  1. Chuẩn hóa input (điểm đi, điểm đến)
  2. Tìm các Stop phù hợp với từ khóa
  3. Tìm các Route nối điểm đi → điểm đến
  4. Lọc Trip theo ngày, trạng thái, số ghế trống
  5. Sắp xếp theo giờ khởi hành
  6. Build response
"""

from datetime import date, datetime, time, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func

from app.models.route import Route, Stop, RouteStop
from app.models.trip import Trip, TripStatus
from app.models.bus import Bus
from app.schemas.search import (
    TripSearchRequest, TripSearchResult, TripSearchResponse,
    SearchMeta, RouteInfo, StopInfo,
)


# ──────────────────────────────────────────────
# Helper: Chuẩn hóa tên tỉnh/thành
# ──────────────────────────────────────────────

PROVINCE_ALIASES: dict[str, list[str]] = {
    "hà nội": ["ha noi", "hn", "hanoi"],
    "hải phòng": ["hai phong", "hp", "haiphong"],
    "đà nẵng": ["da nang", "dn", "danang"],
    "hồ chí minh": ["ho chi minh", "hcm", "sài gòn", "sai gon", "tp.hcm", "tphcm"],
    "cần thơ": ["can tho", "ct"],
    "nha trang": ["khánh hòa", "khanh hoa"],
    "đà lạt": ["da lat", "lâm đồng", "lam dong"],
    "huế": ["hue", "thừa thiên huế"],
    "vinh": ["nghệ an", "nghe an"],
    "quy nhơn": ["quy nhon", "bình định", "binh dinh"],
}


def _normalize_query(query: str) -> str:
    """Loại bỏ dấu cách thừa, lowercase"""
    return " ".join(query.lower().strip().split())


def _build_stop_filter(query: str):
    """
    Tạo điều kiện lọc Stop theo tên, địa chỉ hoặc tỉnh thành.
    Hỗ trợ tìm kiếm bằng ID số hoặc tên.
    """
    q = _normalize_query(query)

    # Nếu là số → tìm theo ID
    if q.isdigit():
        return Stop.id == int(q)

    # Tìm theo tên hoặc tỉnh (LIKE không phân biệt hoa thường)
    like_pattern = f"%{q}%"
    conditions = [
        func.lower(Stop.name).like(like_pattern),
        func.lower(Stop.province).like(like_pattern),
        func.lower(Stop.address).like(like_pattern),
    ]

    # Kiểm tra alias (đặc biệt cho tỉnh/thành)
    for canonical, aliases in PROVINCE_ALIASES.items():
        if q in aliases or q == canonical:
            conditions.append(func.lower(Stop.province).like(f"%{canonical}%"))
            break

    return or_(*conditions)


# ──────────────────────────────────────────────
# Main Service Function
# ──────────────────────────────────────────────

def search_trips(
    db: Session,
    search: TripSearchRequest,
) -> TripSearchResponse:
    """
    Tìm kiếm chuyến xe theo điểm đi, điểm đến và ngày.

    Quy trình:
      Step 1: Tìm các Stop phù hợp với origin query
      Step 2: Tìm các Stop phù hợp với destination query
      Step 3: Tìm Route nối origin_stops → destination_stops
      Step 4: Lọc Trip trong ngày theo route_ids + trạng thái + số ghế
      Step 5: Sắp xếp theo departure_time ASC
      Step 6: Build và trả response
    """

    # ── Step 1: Tìm origin stops ──────────────────
    origin_stops: List[Stop] = (
        db.query(Stop)
        .filter(
            Stop.is_active == True,
            _build_stop_filter(search.origin),
        )
        .all()
    )

    # ── Step 2: Tìm destination stops ────────────
    destination_stops: List[Stop] = (
        db.query(Stop)
        .filter(
            Stop.is_active == True,
            _build_stop_filter(search.destination),
        )
        .all()
    )

    # ── Kiểm tra tìm thấy stops ──────────────────
    if not origin_stops:
        return _empty_response(
            search,
            f"Không tìm thấy điểm xuất phát phù hợp với '{search.origin}'. "
            "Vui lòng kiểm tra lại tên tỉnh/thành hoặc tên trạm.",
        )

    if not destination_stops:
        return _empty_response(
            search,
            f"Không tìm thấy điểm đến phù hợp với '{search.destination}'. "
            "Vui lòng kiểm tra lại tên tỉnh/thành hoặc tên trạm.",
        )

    origin_ids = [s.id for s in origin_stops]
    dest_ids = [s.id for s in destination_stops]

    # ── Step 3: Tìm Route phù hợp ────────────────
    # Route hợp lệ: origin_stop_id nằm trong origin_ids VÀ destination_stop_id nằm trong dest_ids
    matching_routes: List[Route] = (
        db.query(Route)
        .filter(
            Route.is_active == True,
            Route.origin_stop_id.in_(origin_ids),
            Route.destination_stop_id.in_(dest_ids),
        )
        .options(
            joinedload(Route.origin_stop),
            joinedload(Route.destination_stop),
        )
        .all()
    )

    if not matching_routes:
        return _empty_response(
            search,
            f"Không có tuyến xe nào từ '{search.origin}' đến '{search.destination}'. "
            "Vui lòng thử với điểm dừng khác.",
        )

    route_ids = [r.id for r in matching_routes]
    route_map = {r.id: r for r in matching_routes}

    # ── Step 4: Lọc Trip theo ngày + route + status + ghế trống ──
    # Lấy toàn bộ ngày đi: từ 00:00:00 đến 23:59:59
    day_start = datetime.combine(search.departure_date, time.min)
    day_end = datetime.combine(search.departure_date, time.max)

    trips: List[Trip] = (
        db.query(Trip)
        .filter(
            Trip.is_active == True,
            Trip.route_id.in_(route_ids),
            Trip.departure_time >= day_start,
            Trip.departure_time <= day_end,
            Trip.status.in_([TripStatus.SCHEDULED, TripStatus.BOARDING]),
            Trip.available_seats >= search.passengers,  # Đủ ghế trống
        )
        .options(
            joinedload(Trip.bus),
            joinedload(Trip.route).joinedload(Route.origin_stop),
            joinedload(Trip.route).joinedload(Route.destination_stop),
        )
        .order_by(Trip.departure_time.asc())  # ── Step 5: Sắp xếp theo giờ khởi hành
        .all()
    )

    # ── Xử lý không tìm thấy chuyến ─────────────
    if not trips:
        return _empty_response(
            search,
            f"Không có chuyến xe nào từ '{search.origin}' đến '{search.destination}' "
            f"vào ngày {search.departure_date.strftime('%d/%m/%Y')} "
            f"với {search.passengers} hành khách. "
            "Vui lòng thử ngày khác.",
        )

    # ── Step 6: Build response ────────────────────
    results: List[TripSearchResult] = []
    for trip in trips:
        route = trip.route
        duration = int(
            (trip.arrival_time - trip.departure_time).total_seconds() / 60
        )
        result = TripSearchResult(
            trip_id=trip.id,
            route=RouteInfo(
                id=route.id,
                route_code=route.route_code,
                name=route.name,
                origin=StopInfo(
                    id=route.origin_stop.id,
                    name=route.origin_stop.name,
                    province=route.origin_stop.province,
                    address=route.origin_stop.address,
                ),
                destination=StopInfo(
                    id=route.destination_stop.id,
                    name=route.destination_stop.name,
                    province=route.destination_stop.province,
                    address=route.destination_stop.address,
                ),
                distance_km=route.distance_km,
                duration_minutes=route.duration_minutes,
            ),
            departure_time=trip.departure_time,
            arrival_time=trip.arrival_time,
            duration_minutes=duration,
            price=trip.price,
            total_seats=trip.total_seats,
            available_seats=trip.available_seats,
            bus_type=trip.bus.bus_type.value if trip.bus else "standard",
            license_plate=trip.bus.license_plate if trip.bus else "",
            status=trip.status.value,
            driver_name=trip.driver_name,
        )
        results.append(result)

    return TripSearchResponse(
        success=True,
        message=f"Tìm thấy {len(results)} chuyến xe phù hợp.",
        meta=SearchMeta(
            origin_query=search.origin,
            destination_query=search.destination,
            departure_date=search.departure_date,
            passengers=search.passengers,
            total_found=len(results),
            search_at=datetime.utcnow(),
        ),
        data=results,
    )


def get_all_stops(db: Session) -> List[Stop]:
    """Lấy danh sách tất cả điểm dừng đang hoạt động (dùng cho dropdown frontend)"""
    return (
        db.query(Stop)
        .filter(Stop.is_active == True)
        .order_by(Stop.province, Stop.name)
        .all()
    )


# ──────────────────────────────────────────────
# Private Helper
# ──────────────────────────────────────────────

def _empty_response(search: TripSearchRequest, message: str) -> TripSearchResponse:
    """Trả về response rỗng với thông báo phù hợp"""
    return TripSearchResponse(
        success=True,
        message=message,
        meta=SearchMeta(
            origin_query=search.origin,
            destination_query=search.destination,
            departure_date=search.departure_date,
            passengers=search.passengers,
            total_found=0,
            search_at=datetime.utcnow(),
        ),
        data=[],
    )
