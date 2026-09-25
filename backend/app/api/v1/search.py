"""
Router: API Tìm kiếm Tuyến/Chuyến xe

Endpoints:
  POST /api/v1/search/trips          - Tìm kiếm chuyến xe (body JSON)
  GET  /api/v1/search/trips          - Tìm kiếm chuyến xe (query params, tiện test trên browser)
  GET  /api/v1/search/stops          - Lấy danh sách điểm dừng (cho dropdown)
  GET  /api/v1/search/health         - Health check
"""

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.database import get_db
from app.schemas.search import (
    TripSearchRequest,
    TripSearchResponse,
    ErrorResponse,
    StopInfo,
)
from app.services.search_service import search_trips, get_all_stops

router = APIRouter(prefix="/search", tags=["🔍 Tìm kiếm chuyến xe"])


# ──────────────────────────────────────────────
# POST /search/trips — Tìm kiếm (body JSON)
# ──────────────────────────────────────────────

@router.post(
    "/trips",
    response_model=TripSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Tìm kiếm chuyến xe",
    description="""
Tìm kiếm chuyến xe theo điểm đi, điểm đến và ngày khởi hành.

**Quy trình xử lý:**
1. Validate dữ liệu đầu vào (điểm đi/đến/ngày/số hành khách)
2. Tìm các điểm dừng phù hợp với từ khóa
3. Tìm các tuyến xe kết nối điểm đi → điểm đến
4. Lọc chuyến xe theo ngày, trạng thái (scheduled/boarding), số ghế trống ≥ số hành khách
5. Sắp xếp theo giờ khởi hành (sớm nhất trước)
6. Trả kết quả

**Lưu ý:**
- `origin` và `destination` có thể là tên tỉnh/thành, tên trạm, hoặc ID số
- `departure_date` định dạng `YYYY-MM-DD`, không được là ngày quá khứ
- Ngày đi và điểm đi/đến không được trùng nhau
""",
    responses={
        200: {"description": "Tìm kiếm thành công (có thể trả danh sách rỗng)"},
        422: {"model": ErrorResponse, "description": "Dữ liệu đầu vào không hợp lệ"},
        500: {"model": ErrorResponse, "description": "Lỗi server"},
    },
)
def search_trips_post(
    search_request: TripSearchRequest,
    db: Session = Depends(get_db),
):
    """
    Tìm kiếm chuyến xe qua HTTP POST với body JSON.
    Phù hợp để tích hợp từ Frontend.
    """
    try:
        return search_trips(db=db, search=search_request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi tìm kiếm: {str(exc)}",
        )


# ──────────────────────────────────────────────
# GET /search/trips — Tìm kiếm (query params)
# ──────────────────────────────────────────────

@router.get(
    "/trips",
    response_model=TripSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Tìm kiếm chuyến xe (GET)",
    description="Tìm kiếm chuyến xe qua query parameters — tiện dùng để test trực tiếp trên browser hoặc curl.",
)
def search_trips_get(
    origin: str = Query(
        ...,
        min_length=2,
        max_length=200,
        description="Điểm xuất phát",
        examples=["Hà Nội"],
    ),
    destination: str = Query(
        ...,
        min_length=2,
        max_length=200,
        description="Điểm đến",
        examples=["Hải Phòng"],
    ),
    departure_date: date = Query(
        ...,
        description="Ngày đi (YYYY-MM-DD)",
        examples=["2026-09-26"],
    ),
    passengers: int = Query(
        default=1,
        ge=1,
        le=50,
        description="Số hành khách",
    ),
    db: Session = Depends(get_db),
):
    """
    Tìm kiếm chuyến xe qua GET query parameters.
    Kết quả giống hệt POST endpoint.
    """
    try:
        search_request = TripSearchRequest(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            passengers=passengers,
        )
    except ValidationError as exc:
        errors = [
            {"field": ".".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
            for e in exc.errors()
        ]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=errors,
        )

    try:
        return search_trips(db=db, search=search_request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống: {str(exc)}",
        )


# ──────────────────────────────────────────────
# GET /search/stops — Danh sách điểm dừng
# ──────────────────────────────────────────────

@router.get(
    "/stops",
    response_model=list[StopInfo],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách điểm dừng",
    description="Trả về toàn bộ điểm dừng/trạm đang hoạt động. Dùng để render dropdown tìm kiếm trên Frontend.",
)
def list_stops(db: Session = Depends(get_db)):
    """Lấy danh sách điểm dừng cho dropdown tìm kiếm"""
    stops = get_all_stops(db)
    return [
        StopInfo(
            id=s.id,
            name=s.name,
            province=s.province,
            address=s.address,
        )
        for s in stops
    ]


# ──────────────────────────────────────────────
# GET /search/health — Health check
# ──────────────────────────────────────────────

@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Health check",
    include_in_schema=False,
)
def health_check(db: Session = Depends(get_db)):
    """Kiểm tra trạng thái kết nối DB"""
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database không kết nối được: {str(exc)}",
        )
