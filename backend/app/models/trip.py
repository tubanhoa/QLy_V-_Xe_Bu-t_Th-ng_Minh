"""
Model: Chuyến xe (Trip)

Mỗi chuyến xe là một lịch chạy cụ thể của một Route trên một xe (Bus)
vào một ngày/giờ nhất định.

TripStatus:
  - scheduled:  Đã lên lịch, chưa chạy
  - boarding:   Đang đón khách
  - in_transit: Đang trên đường
  - completed:  Đã hoàn thành
  - cancelled:  Đã hủy
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    Enum, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class TripStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    BOARDING = "boarding"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Trip(Base):
    """Chuyến xe cụ thể"""
    __tablename__ = "trips"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Quan hệ với Route và Bus
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False, index=True)
    bus_id = Column(Integer, ForeignKey("buses.id"), nullable=False)

    # Thời gian
    departure_time = Column(DateTime, nullable=False, index=True,
                            comment="Thời gian khởi hành")
    arrival_time = Column(DateTime, nullable=False,
                          comment="Thời gian dự kiến đến nơi")

    # Ghế và giá vé
    total_seats = Column(Integer, nullable=False, comment="Tổng số ghế của chuyến")
    available_seats = Column(Integer, nullable=False, comment="Số ghế còn trống")
    price = Column(Float, nullable=False, comment="Giá vé (VND)")

    # Trạng thái
    status = Column(
        Enum(TripStatus),
        nullable=False,
        default=TripStatus.SCHEDULED,
        index=True,
        comment="Trạng thái chuyến xe"
    )

    # Thông tin thêm
    driver_name = Column(String(200), nullable=True, comment="Tài xế phụ trách")  # type: ignore[name-defined]
    notes = Column(Text, nullable=True, comment="Ghi chú nội bộ")
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    route = relationship("Route", back_populates="trips")
    bus = relationship("Bus", back_populates="trips")

    def __repr__(self):
        return (
            f"<Trip id={self.id} route={self.route_id} "
            f"departure={self.departure_time} status={self.status}>"
        )
