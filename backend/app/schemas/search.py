"""
Schemas Pydantic cho Tìm kiếm Tuyến/Chuyến xe

SearchRequest  : Dữ liệu đầu vào từ client (điểm đi, điểm đến, ngày đi, số hành khách)
TripResult     : Một chuyến xe trong kết quả tìm kiếm
SearchResponse : Toàn bộ response trả về client
"""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator
import re


# ──────────────────────────────────────────────
# Request Schema
# ──────────────────────────────────────────────

class TripSearchRequest(BaseModel):
    """
    Dữ liệu tìm kiếm chuyến xe.
    Tất cả trường đều bắt buộc trừ `passengers`.
    """
    origin: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Tên hoặc ID điểm xuất phát (tỉnh/thành hoặc tên trạm)",
        examples=["Hà Nội", "Hải Phòng", "1"],
    )
    destination: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Tên hoặc ID điểm đến (tỉnh/thành hoặc tên trạm)",
        examples=["Hải Phòng", "Đà Nẵng", "2"],
    )
    departure_date: date = Field(
        ...,
        description="Ngày đi (YYYY-MM-DD)",
        examples=["2026-09-26"],
    )
    passengers: int = Field(
        default=1,
        ge=1,
        le=50,
        description="Số hành khách (1–50)",
    )

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip()

    @field_validator("origin", "destination")
    @classmethod
    def not_empty_after_strip(cls, v: str) -> str:
        if not v:
            raise ValueError("Không được để trống")
        return v

    @field_validator("departure_date", mode="before")
    @classmethod
    def parse_date(cls, v):
        """Chấp nhận cả string 'YYYY-MM-DD' và date object"""
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            v = v.strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}$", v):
                return date.fromisoformat(v)
            # Hỗ trợ thêm định dạng DD/MM/YYYY
            if re.match(r"^\d{2}/\d{2}/\d{4}$", v):
                day, month, year = v.split("/")
                return date(int(year), int(month), int(day))
        raise ValueError("Ngày không hợp lệ, định dạng yêu cầu: YYYY-MM-DD")

    @model_validator(mode="after")
    def validate_origin_destination_differ(self):
        """Điểm đi và điểm đến không được trùng nhau"""
        if self.origin.lower() == self.destination.lower():
            raise ValueError("Điểm đi và điểm đến không được trùng nhau")
        return self

    @model_validator(mode="after")
    def validate_departure_date_not_past(self):
        """Ngày đi không được là ngày trong quá khứ"""
        today = date.today()
        if self.departure_date < today:
            raise ValueError(
                f"Ngày đi ({self.departure_date}) không được là ngày trong quá khứ. "
                f"Ngày hiện tại: {today}"
            )
        return self

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "origin": "Hà Nội",
                    "destination": "Hải Phòng",
                    "departure_date": "2026-09-26",
                    "passengers": 2,
                }
            ]
        }
    }


# ──────────────────────────────────────────────
# Response Schemas
# ──────────────────────────────────────────────

class StopInfo(BaseModel):
    """Thông tin ngắn gọn của một điểm dừng"""
    id: int
    name: str
    province: str
    address: Optional[str] = None

    model_config = {"from_attributes": True}


class RouteInfo(BaseModel):
    """Thông tin tuyến xe trong kết quả"""
    id: int
    route_code: str
    name: str
    origin: StopInfo
    destination: StopInfo
    distance_km: Optional[float] = None
    duration_minutes: Optional[int] = None

    model_config = {"from_attributes": True}


class TripSearchResult(BaseModel):
    """Một chuyến xe trong kết quả tìm kiếm"""
    trip_id: int
    route: RouteInfo
    departure_time: datetime
    arrival_time: datetime
    duration_minutes: int
    price: float
    total_seats: int
    available_seats: int
    bus_type: str
    license_plate: str
    status: str
    driver_name: Optional[str] = None

    model_config = {"from_attributes": True}


class SearchMeta(BaseModel):
    """Metadata kết quả tìm kiếm"""
    origin_query: str
    destination_query: str
    departure_date: date
    passengers: int
    total_found: int
    search_at: datetime


class TripSearchResponse(BaseModel):
    """Response API tìm kiếm chuyến xe"""
    success: bool = True
    message: str
    meta: SearchMeta
    data: List[TripSearchResult]


class ErrorDetail(BaseModel):
    """Chi tiết lỗi validation"""
    field: str
    message: str


class ErrorResponse(BaseModel):
    """Response khi có lỗi"""
    success: bool = False
    message: str
    errors: Optional[List[ErrorDetail]] = None
