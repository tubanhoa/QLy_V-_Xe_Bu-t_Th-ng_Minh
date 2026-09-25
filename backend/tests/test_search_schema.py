"""
Tests cho API tìm kiếm chuyến xe

Chạy: cd backend && python -m pytest tests/ -v
"""

import pytest
from datetime import date, timedelta
from pydantic import ValidationError
from app.schemas.search import TripSearchRequest


class TestTripSearchRequest:
    """Kiểm tra validation của TripSearchRequest"""

    def test_valid_request(self):
        """Request hợp lệ"""
        tomorrow = date.today() + timedelta(days=1)
        req = TripSearchRequest(
            origin="Hà Nội",
            destination="Hải Phòng",
            departure_date=tomorrow.isoformat(),
            passengers=2,
        )
        assert req.origin == "Hà Nội"
        assert req.destination == "Hải Phòng"
        assert req.passengers == 2

    def test_default_passengers(self):
        """Mặc định passengers = 1"""
        tomorrow = date.today() + timedelta(days=1)
        req = TripSearchRequest(
            origin="Hà Nội",
            destination="Hải Phòng",
            departure_date=tomorrow.isoformat(),
        )
        assert req.passengers == 1

    def test_same_origin_destination_raises(self):
        """Điểm đi = điểm đến → lỗi"""
        tomorrow = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError) as exc:
            TripSearchRequest(
                origin="Hà Nội",
                destination="Hà Nội",
                departure_date=tomorrow.isoformat(),
            )
        assert "trùng" in str(exc.value).lower() or "same" in str(exc.value).lower()

    def test_past_date_raises(self):
        """Ngày trong quá khứ → lỗi"""
        yesterday = date.today() - timedelta(days=1)
        with pytest.raises(ValidationError) as exc:
            TripSearchRequest(
                origin="Hà Nội",
                destination="Hải Phòng",
                departure_date=yesterday.isoformat(),
            )
        assert "quá khứ" in str(exc.value) or "past" in str(exc.value).lower()

    def test_invalid_date_format_raises(self):
        """Sai định dạng ngày → lỗi"""
        with pytest.raises(ValidationError):
            TripSearchRequest(
                origin="Hà Nội",
                destination="Hải Phòng",
                departure_date="26-09-2026",  # Sai: nên là 2026-09-26
            )

    def test_date_format_dd_mm_yyyy(self):
        """Hỗ trợ định dạng DD/MM/YYYY"""
        tomorrow = date.today() + timedelta(days=1)
        req = TripSearchRequest(
            origin="Hà Nội",
            destination="Hải Phòng",
            departure_date=tomorrow.strftime("%d/%m/%Y"),
        )
        assert req.departure_date == tomorrow

    def test_passengers_too_many_raises(self):
        """Quá 50 hành khách → lỗi"""
        tomorrow = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError):
            TripSearchRequest(
                origin="Hà Nội",
                destination="Hải Phòng",
                departure_date=tomorrow.isoformat(),
                passengers=51,
            )

    def test_passengers_zero_raises(self):
        """0 hành khách → lỗi"""
        tomorrow = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError):
            TripSearchRequest(
                origin="Hà Nội",
                destination="Hải Phòng",
                departure_date=tomorrow.isoformat(),
                passengers=0,
            )

    def test_origin_whitespace_stripped(self):
        """Chuỗi có dấu cách thừa được cắt"""
        tomorrow = date.today() + timedelta(days=1)
        req = TripSearchRequest(
            origin="  Hà Nội  ",
            destination="Hải Phòng",
            departure_date=tomorrow.isoformat(),
        )
        assert req.origin == "Hà Nội"

    def test_empty_origin_raises(self):
        """Origin rỗng → lỗi"""
        tomorrow = date.today() + timedelta(days=1)
        with pytest.raises(ValidationError):
            TripSearchRequest(
                origin="",
                destination="Hải Phòng",
                departure_date=tomorrow.isoformat(),
            )

    def test_today_is_valid(self):
        """Ngày hôm nay là hợp lệ (không phải quá khứ)"""
        today = date.today()
        req = TripSearchRequest(
            origin="Hà Nội",
            destination="Hải Phòng",
            departure_date=today.isoformat(),
        )
        assert req.departure_date == today
